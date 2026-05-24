import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Shifting territory to Gaochang ---');
  try {
    const geojson = {
      type: 'Polygon',
      coordinates: [
        [
          [89.185, 42.912],
          [89.200, 42.912],
          [89.200, 42.925],
          [89.185, 42.925],
          [89.185, 42.912]
        ]
      ]
    };

    const res = await prisma.territories.update({
      where: { id: 'terr_0172b25b5755460d83ef03e3' },
      data: {
        geojson_json: geojson
      }
    });
    console.log('Successfully updated territory coordinates:', JSON.stringify(res, null, 2));
  } catch (error) {
    console.error('Error shifting territory:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
