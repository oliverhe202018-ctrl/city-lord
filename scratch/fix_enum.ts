import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Altering Enum TerritoryEventType ---');
  try {
    // ALTER TYPE ADD VALUE cannot run inside a transaction, but executeRawUnsafe runs it directly
    await prisma.$executeRawUnsafe(`ALTER TYPE public."TerritoryEventType" ADD VALUE 'RECONCILE_ADJUST'`);
    console.log('Successfully added RECONCILE_ADJUST to TerritoryEventType enum.');
  } catch (err: any) {
    if (err.message.includes('already exists')) {
      console.log('RECONCILE_ADJUST already exists in enum.');
    } else {
      console.error('Error altering enum:', err.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
