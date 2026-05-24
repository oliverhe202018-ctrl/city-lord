import { PrismaClient } from '@prisma/client';
import { processTerritorySettlement } from '../lib/territory/settlement';
import { cleanAndSplitTrajectory } from '../lib/gis/geometry-cleaner';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Manual Run Settlement Tool ===');
  
  // Find runs that are either not completed/failed/flagged OR completed but have 0 territories and some polygons
  const pendingRuns = await prisma.runs.findMany({
    where: {
      OR: [
        {
          status: {
            notIn: ['completed', 'failed', 'flagged']
          }
        },
        {
          status: 'completed',
          new_territories_count: 0,
          NOT: {
            polygons: {
              equals: []
            }
          }
        }
      ]
    }
  });

  console.log(`Found ${pendingRuns.length} pending runs to settle.`);

  for (const run of pendingRuns) {
    console.log(`\nProcessing Run ID: ${run.id}`);
    console.log(`- User ID: ${run.user_id}`);
    console.log(`- Area: ${run.area}`);
    console.log(`- Distance: ${run.distance}`);

    const polygons = run.polygons as any[];
    if (!polygons || polygons.length === 0) {
      console.log(`- No polygons in run. Marking as completed (no territories).`);
      await prisma.runs.update({
        where: { id: run.id },
        data: { status: 'completed', updated_at: new Date() }
      });
      continue;
    }

    const cityId = run.city_id || 'wulumuqi'; // Default fallback city ID
    console.log(`- Using City ID: ${cityId}`);

    let settledCount = 0;
    let reinforcedCount = 0;

    for (const polyPoints of polygons) {
      if (!polyPoints || polyPoints.length < 3) {
        console.warn(`- Skipping polygon with too few points: ${polyPoints?.length}`);
        continue;
      }

      const rawCoords = polyPoints.map((p: any) => [p.lng, p.lat] as [number, number]);
      const cleanedPolys = cleanAndSplitTrajectory(rawCoords);
      if (cleanedPolys.length === 0) {
        console.warn(`- Trajectory cleaning yielded 0 valid polygons.`);
        continue;
      }

      for (const polyFeature of cleanedPolys) {
        try {
          const settlement = await processTerritorySettlement({
            runId: run.id,
            userId: run.user_id!,
            cityId,
            clubId: run.club_id,
            pathGeoJSON: polyFeature,
            preProcessedPolygons: [polyFeature]
          });

          if (settlement.success) {
            settledCount += settlement.createdTerritories;
            reinforcedCount += settlement.reinforcedTerritories;
            console.log(`  + Settlement success: created ${settlement.createdTerritories}, reinforced ${settlement.reinforcedTerritories}`);
          } else {
            console.error(`  - Settlement failed:`, settlement.error);
          }
        } catch (e: any) {
          console.error(`  - Error processing polygon:`, e.message);
        }
      }
    }

    // Update run
    await prisma.runs.update({
      where: { id: run.id },
      data: {
        new_territories_count: settledCount,
        reinforced_territories_count: reinforcedCount,
        status: 'completed',
        updated_at: new Date()
      }
    });
    console.log(`- Run ${run.id} updated. Status: completed. Created ${settledCount} territories.`);
  }

  console.log('\n=== Settlement complete! ===');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
