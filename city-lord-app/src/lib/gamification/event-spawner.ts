import { task, logger } from '@trigger.dev/sdk/v3';
import { schedules } from '@trigger.dev/sdk/v3';
import { RandomEventType } from '@prisma/client';
import { z } from 'zod';
import * as turf from "@turf/turf";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import { redis } from '@/lib/redis';
import { EventRewardPayload, EventType } from './types';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

interface NewEventPayload {
  city_id: string;
  lat: number;
  lng: number;
  type: RandomEventType;
  reward_payload: EventRewardPayload;
  expires_at: Date;
}

// Define weights for each event type
const eventWeights: { type: EventType; weight: number }[] = [
  { type: "TREASURE", weight: 50 },
  { type: "AMBUSH", weight: 25 },
  { type: "MYSTERY", weight: 15 },
  { type: "BLESSING", weight: 10 },
];

const totalWeight = eventWeights.reduce((sum, event) => sum + event.weight, 0);

function getRandomEventType(): EventType {
  let random = Math.random() * totalWeight;
  for (const event of eventWeights) {
    if (random < event.weight) {
      return event.type;
    }
    random -= event.weight;
  }
  return "TREASURE"; // Fallback
}

function getRewardPayload(eventType: EventType): EventRewardPayload {
  switch (eventType) {
    case "TREASURE":
      return { points: 100, levelXp: 50, areaMultiplier: 1.5 };
    case "AMBUSH":
      return { ambush: { health_reduction_percent: 25 } };
    case "BLESSING":
      return { staminaBoost: 50 };
    case "MYSTERY":
      return { mystery_item_id: "special_item_001" };
    default:
      return {};
  }
}

export const spawnDailyEventsForAllCities = task({
  id: "spawn-daily-events-for-all-cities",
  run: async () => {
    logger.info("Starting daily event spawner task.");

    // 1. Expire Old Events
    const now = new Date();
    const expiredResult = await prisma.random_events.updateMany({
      where: {
        status: "ACTIVE",
        expires_at: { lt: now },
      },
      data: {
        status: "EXPIRED",
      },
    });
    logger.info(`Expired ${expiredResult.count} old events.`);

    // 2. Fetch active cities and their territories
    const territories = await prisma.territories.findMany({
      where: {
        status: "ACTIVE",
        geojson_json: {
          not: { equals: Prisma.JsonNull },
        },
      },
      select: {
        city_id: true,
        geojson_json: true,
      },
    });

    const cityTerritories = territories.reduce((acc, territory) => {
      if (territory.city_id && territory.geojson_json) {
        if (!acc[territory.city_id]) {
          acc[territory.city_id] = [];
        }
        // @ts-ignore
        acc[territory.city_id].push(turf.feature(territory.geojson_json));
      }
      return acc;
    }, {} as Record<string, Feature<Polygon | MultiPolygon>[]>);

    const allNewEvents: NewEventPayload[] = [];
    const expires_at = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // 3. Spawn New Events for each city
    const MAX_ATTEMPTS = 50;
    
    for (const cityId in cityTerritories) {
        const cityFeatures = cityTerritories[cityId];
        if(cityFeatures.length === 0) continue;

        // Merge all features into a single polygon using turf.union
        let unionedFeature: Feature<Polygon | MultiPolygon> | null = null;
        
        for (const feature of cityFeatures) {
            if (!unionedFeature) {
                unionedFeature = feature;
            } else {
                const merged = turf.union(turf.featureCollection([unionedFeature, feature]));
                if (merged) unionedFeature = merged as Feature<Polygon | MultiPolygon>;
            }
        }

        if (!unionedFeature) continue;

        // Get bounding box from the unioned feature
        const cityBoundingBox = turf.bbox(unionedFeature);

        const eventCount = Math.floor(Math.random() * 3) + 3; // 3-5 events
        let attempts = 0;
        const cityEvents: NewEventPayload[] = [];

        while(cityEvents.length < eventCount && attempts < MAX_ATTEMPTS) {
            const randomPt = turf.randomPoint(1, { bbox: cityBoundingBox }).features[0];

            // Check if the point is within the unioned polygon (much more efficient)
            const isInside = turf.booleanPointInPolygon(randomPt, unionedFeature);

            if(isInside) {
                const eventType = getRandomEventType();
                const rewardPayload = getRewardPayload(eventType);
                cityEvents.push({
                    city_id: cityId,
                    lat: randomPt.geometry.coordinates[1],
                    lng: randomPt.geometry.coordinates[0],
                    type: eventType as RandomEventType,
                    reward_payload: rewardPayload,
                    expires_at,
                });
            }
            attempts++;
        }
        allNewEvents.push(...cityEvents);
        logger.info(`Generated ${cityEvents.length} new events for city ${cityId} (attempts: ${attempts}).`);
    }

    // 4. Bulk Insert New Events
    if (allNewEvents.length > 0) {
      const createResult = await prisma.random_events.createMany({
        data: allNewEvents,
      });
      logger.info(`Successfully inserted ${createResult.count} new events.`);

      // 5. Cache new events in Redis
      try {
        const pipeline = redis.pipeline();
        const eventsByCity: Record<string, any[]> = {};

        // Group events by city for efficient caching
        for (const event of allNewEvents) {
            if (!eventsByCity[event.city_id]) {
                eventsByCity[event.city_id] = [];
            }
            eventsByCity[event.city_id].push(event);
        }

        // In a real scenario, you might fetch existing events and merge,
        // but for a daily spawn, overwriting is simpler.
        for (const cityId in eventsByCity) {
            const key = `events:${cityId}`;
            // Store the whole array of events as a stringified JSON
            pipeline.set(key, JSON.stringify(eventsByCity[cityId]));
        }

        await pipeline.exec();
        logger.info(`Successfully cached events for ${Object.keys(eventsByCity).length} cities in Redis.`);

      } catch (error) {
        logger.error("Failed to cache events in Redis", { error });
        // This is a non-critical failure, so we don't re-throw.
      }

    } else {
        logger.info("No new events were generated.");
    }

    return { status: "success", spawned: allNewEvents.length };
  },
});

// Daily CRON schedule for automatic event spawning
// Runs every day at 03:00 AM UTC (low user activity time, ideal for map resets)
// TODO: schedules.create is deprecated in @trigger.dev/sdk v3.x+
// Replace with inline cron trigger when upgrading Trigger.dev SDK
// @ts-ignore
export const dailySpawnerSchedule = schedules.create({
  task: "spawn-daily-events-for-all-cities", // Task ID as string
  cron: "0 3 * * *", // 3 AM UTC every day
});


