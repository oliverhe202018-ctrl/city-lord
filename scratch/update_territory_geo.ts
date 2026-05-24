import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Updating Territory Geometry to Wulumuqi ---');
  const targetId = 'terr_0172b25b5755460d83ef03e3';
  const geojson = {
    type: 'Polygon',
    coordinates: [
      [
        [87.510, 43.830],
        [87.520, 43.830],
        [87.520, 43.840],
        [87.510, 43.840],
        [87.510, 43.830]
      ]
    ]
  };

  try {
    const updated = await prisma.territories.update({
      where: { id: targetId },
      data: {
        geojson_json: geojson,
        area_m2_exact: 1000000 // 1 km2 approx
      }
    });
    console.log(`Success! Updated geometry for territory: ${updated.id}`);
  } catch (err: any) {
    console.error('Update failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
