import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- DB Cities & Active User ---');
  try {
    const cities = await prisma.cities.findMany();
    console.log('Cities in DB:', JSON.stringify(cities, null, 2));

    const user = await prisma.profiles.findUnique({
      where: { id: 'a4e43427-4a7d-45a8-97e5-c095070d7f7e' }
    });
    console.log('Active User Profile:', JSON.stringify(user, null, 2));

    const territories = await prisma.territories.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        city_id: true,
        owner_id: true
      }
    });
    console.log('Active Territories Summary:', territories);
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
