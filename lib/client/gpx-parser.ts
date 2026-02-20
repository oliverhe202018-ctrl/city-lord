/**
 * gpx-parser.ts
 *
 * Browser-only utility for parsing .gpx files into WatchSyncPayload.
 * Uses `togeojson` (installed as a dependency) for GPX → GeoJSON conversion.
 *
 * NOTE: This file MUST only be imported in client components or dynamic imports
 * because it uses DOMParser (browser API).
 */

// togeojson is a CJS module; it exports an object with a `gpx` method
// eslint-disable-next-line @typescript-eslint/no-require-imports
const togeojson = require('togeojson') as {
    gpx: (doc: Document) => GeoJSON.FeatureCollection;
};

import { haversineDistance } from '@/lib/geometry-utils';
import type { WatchSyncPayload, WatchTrackPoint } from '@/types/watch-sync';

// ─────────────────────────────────────────────────────────────────────────────
// GeoJSON type augmentations (togeojson-specific property shapes)
// ─────────────────────────────────────────────────────────────────────────────

interface GpxProperties {
    /** ISO 8601 timestamps corresponding to each coordinate */
    coordTimes?: string[];
    /** Activity name from <name> tag */
    name?: string;
    /** Heart rate values (if embedded as extensions) */
    heartRates?: number[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function calculateTotalDistance(points: WatchTrackPoint[]): number {
    if (points.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < points.length; i++) {
        total += haversineDistance(
            points[i - 1].lat,
            points[i - 1].lng,
            points[i].lat,
            points[i].lng,
        );
    }
    return total;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export class GpxParseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GpxParseError';
    }
}

/**
 * Parse a .gpx File object into a WatchSyncPayload ready for syncWatchRunData.
 *
 * @throws {GpxParseError} if the file cannot be parsed or has insufficient data
 */
export async function parseGpxFile(file: File): Promise<WatchSyncPayload> {
    // 1. Read file text
    const text = await file.text();

    // 2. Parse XML
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');

    // Check for XML parse errors
    const parseError = xml.querySelector('parsererror');
    if (parseError) {
        throw new GpxParseError(`GPX 文件格式无效：${parseError.textContent?.slice(0, 100)}`);
    }

    // 3. Convert to GeoJSON
    const geoJson = togeojson.gpx(xml);

    if (!geoJson.features || geoJson.features.length === 0) {
        throw new GpxParseError('GPX 文件中未找到轨迹数据（<trk> 或 <rte> 标签）');
    }

    // 4. Extract points from all features
    const allPoints: WatchTrackPoint[] = [];

    for (const feature of geoJson.features) {
        if (!feature.geometry) continue;

        const props = (feature.properties ?? {}) as GpxProperties;
        const coordTimes = props.coordTimes ?? [];
        const heartRates = props.heartRates ?? [];

        const extractCoords = (
            coords: number[][],
            times: string[],
        ): void => {
            coords.forEach((coord, idx) => {
                // togeojson uses [lon, lat, elevation?]
                const lng = coord[0];
                const lat = coord[1];

                if (lat === undefined || lng === undefined) return;
                if (isNaN(lat) || isNaN(lng)) return;

                // Parse timestamp — fall back to synthesized time
                let timestamp: number;
                if (times[idx]) {
                    timestamp = new Date(times[idx]).getTime();
                    if (isNaN(timestamp)) {
                        // Use last known + 5s if time is malformed
                        const prev = allPoints[allPoints.length - 1];
                        timestamp = prev ? prev.timestamp + 5000 : Date.now();
                    }
                } else {
                    // No time data — synthesize 5-second intervals
                    const prev = allPoints[allPoints.length - 1];
                    timestamp = prev ? prev.timestamp + 5000 : Date.now() - 600_000;
                }

                const point: WatchTrackPoint = { lat, lng, timestamp };

                const hr = heartRates[idx];
                if (hr && hr > 0) {
                    point.heartRate = Math.round(hr);
                }

                allPoints.push(point);
            });
        };

        const geom = feature.geometry;
        if (geom.type === 'LineString') {
            extractCoords(geom.coordinates as number[][], coordTimes);
        } else if (geom.type === 'MultiLineString') {
            // Flatten all line segments
            let timeOffset = 0;
            for (const segment of geom.coordinates as number[][][]) {
                const segTimes = coordTimes.slice(timeOffset, timeOffset + segment.length);
                extractCoords(segment, segTimes);
                timeOffset += segment.length;
            }
        }
    }

    if (allPoints.length < 2) {
        throw new GpxParseError(`GPX 文件中的轨迹点太少（仅 ${allPoints.length} 个），需要至少 2 个点`);
    }

    // 5. Sort by timestamp to ensure chronological order
    allPoints.sort((a, b) => a.timestamp - b.timestamp);

    // 6. Calculate summary
    const totalDistance = calculateTotalDistance(allPoints);
    const startTime = new Date(allPoints[0].timestamp).toISOString();
    const endTime = new Date(allPoints[allPoints.length - 1].timestamp).toISOString();

    // Estimate steps: ~1300 steps/km is a reasonable average for running
    const totalSteps = Math.round((totalDistance / 1000) * 1300);

    const payload: WatchSyncPayload = {
        points: allPoints,
        summary: {
            totalDistance,
            totalSteps,
            startTime,
            endTime,
        },
    };

    return payload;
}
