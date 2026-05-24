import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Altering Enum TerritoryEventType to add all values ---');
  const values = [
    'CLAIM',
    'DETACH_CLUB',
    'FACTION_BETRAYAL',
    'ABANDON',
    'CLUB_DISBAND',
    'SYSTEM_RESET',
    'DECAY_DAMAGE',
    'DECAY_NEUTRALIZE'
  ];

  for (const val of values) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TYPE public."TerritoryEventType" ADD VALUE '${val}'`);
      console.log(`Successfully added ${val} to TerritoryEventType enum.`);
    } catch (err: any) {
      if (err.message.includes('already exists')) {
        console.log(`${val} already exists in enum.`);
      } else {
        console.error(`Error adding ${val}:`, err.message);
      }
    }
  }
  console.log('Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
