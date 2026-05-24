import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Querying Enum Values ---');
  try {
    const enumValues = await prisma.$queryRaw`
      SELECT enumlabel 
      FROM pg_enum 
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
      WHERE pg_type.typname = 'TerritoryEventType';
    `;
    console.log('Enum values for TerritoryEventType:', enumValues);

    const checkConstraints = await prisma.$queryRaw`
      SELECT conname, pg_get_constraintdef(oid) 
      FROM pg_constraint 
      WHERE conname = 'check_valid_event_type';
    `;
    console.log('Check constraint check_valid_event_type:', checkConstraints);
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
