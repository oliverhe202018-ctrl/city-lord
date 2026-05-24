import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- DB Profiles & Clubs ---');
  try {
    const profiles = await prisma.profiles.findMany({
      take: 10
    });
    console.log('Profiles:', JSON.stringify(profiles, null, 2));

    const clubs = await prisma.clubs.findMany({
      take: 10
    });
    console.log('Clubs:', JSON.stringify(clubs, null, 2));
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
