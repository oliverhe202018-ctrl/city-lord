import { PrismaClient } from '@prisma/client';
import { cleanAndSplitTrajectory } from './lib/gis/geometry-cleaner';
import { processTerritorySettlement } from './lib/territory/settlement';

const prisma = new PrismaClient();

async function main() {
  const runId = 'f9615839-6939-46cc-b1d6-b8c97a502496';
  const cityId = '4b4b9f10-c517-409f-a951-e9b98751b75e';
  console.log(`Loading run ${runId}`);
  const run = await prisma.runs.findUnique({
    where: { id: runId }
  });

  if (!run) {
    console.error('Run not found');
    return;
  }

  const { user_id, club_id, polygons, distance, duration } = run;
  console.log(`userId: ${user_id}, cityId: ${cityId}`);
  console.log(`Polygons count: ${Array.isArray(polygons) ? polygons.length : typeof polygons}`);

  let settledCount = 0;
  let reinforcedCount = 0;

  if (Array.isArray(polygons) && polygons.length > 0) {
    for (const polyPoints of polygons as any[]) {
      if (!polyPoints || polyPoints.length < 3) {
        console.warn(`Skip <3 points polygon`);
        continue;
      }
      const rawCoords = polyPoints.map((p: any) => [p.lng, p.lat] as [number, number]);
      // Validation ...
      const invalidCoords = rawCoords.filter(([lng, lat]: any) =>
          isNaN(lng) || isNaN(lat) ||
          lat < -90 || lat > 90 ||
          lng < -180 || lng > 180 ||
          lat < 3 || lat > 55 ||
          lng < 70 || lng > 140
      );
      if (invalidCoords.length > 0) {
          console.warn(`contains ${invalidCoords.length} invalid coords. First invalid:`, invalidCoords[0]);
          continue;
      }

      console.log(`Clean and split... coords count: ${rawCoords.length}`);
      const cleanedPolys = cleanAndSplitTrajectory(rawCoords);
      console.log(`Cleaned polys count: ${cleanedPolys.length}`);

      for (const polyFeature of cleanedPolys) {
        console.log(`Processing settlement... for city: ${cityId}`);
        try {
          const settlement = await processTerritorySettlement({
              runId,
              userId: user_id as string,
              cityId: cityId,
              clubId: club_id as string | null,
              pathGeoJSON: polyFeature,
              preProcessedPolygons: [polyFeature]
          });
          console.log(`Settlement Result:`, JSON.stringify(settlement, null, 2));
          if (settlement.success) {
            settledCount += settlement.createdTerritories;
            reinforcedCount += settlement.reinforcedTerritories;
          }
        } catch (e) {
          console.error(`processTerritorySettlement threw:`, e);
        }
      }
    }
  } else {
    console.log('Polygons is not array or empty');
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
