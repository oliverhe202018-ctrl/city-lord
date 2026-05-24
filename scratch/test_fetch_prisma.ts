import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Querying territories via Prisma ---');
  try {
    const territories = await prisma.territories.findMany({
      where: {
        city_id: 'wulumuqi',
        status: 'ACTIVE'
      },
      include: {
        clubs: true,
        profiles: true
      },
      take: 10
    });

    console.log(`Success! Fetched ${territories.length} active territories for wulumuqi.`);
    if (territories.length > 0) {
      console.log('First territory sample details:');
      const t = territories[0];
      console.log('- ID:', t.id);
      console.log('- Owner ID:', t.owner_id);
      console.log('- Owner Club ID:', t.owner_club_id);
      console.log('- Owner Faction:', t.owner_faction);
      console.log('- Club Logo/Avatar URL:', t.clubs?.avatar_url);
      console.log('- Profile Fill Color:', t.profiles?.fill_color);
      console.log('- GeoJSON type:', (t.geojson_json as any)?.type);
    }
  } catch (err: any) {
    console.error('Prisma query failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
