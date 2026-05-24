import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Querying Rooms ---');
  try {
    const rooms = await prisma.rooms.findMany({
      take: 10
    });
    console.log('Rooms in DB:', JSON.stringify(rooms, null, 2));
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
