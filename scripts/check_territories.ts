import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- DB Inspection ---');
  try {
    const territoriesCount = await prisma.territories.count();
    console.log(`Total territories in DB: ${territoriesCount}`);

    const activeTerritories = await prisma.territories.findMany({
      where: { status: 'ACTIVE' },
      take: 10,
    });
    console.log('Active Territories Sample:', JSON.stringify(activeTerritories, null, 2));

    const runDetail = await prisma.runs.findUnique({
      where: { id: "bc1ad04f-c2d8-48cb-977a-3ad796df96e9" }
    });
    console.log('Run Detail:', JSON.stringify(runDetail, null, 2));

    try {
      console.log('Searching pg_constraint for RECONCILE_ADJUST...');
      const constraints = await prisma.$queryRaw`
        SELECT conname, pg_get_constraintdef(c.oid) as def
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE pg_get_constraintdef(c.oid) LIKE '%RECONCILE_ADJUST%';
      `;
      console.log('Matching constraints:', constraints);

      console.log('Checking territory_events column types...');
      const colTypes = await prisma.$queryRaw`
        SELECT column_name, data_type, udt_name 
        FROM information_schema.columns 
        WHERE table_name = 'territory_events';
      `;
      console.log('Columns of territory_events:', colTypes);

    } catch (dbErr: any) {
      console.error('Failed to query catalog:', dbErr.message);
    }

    const cities = await prisma.cities.findMany();
    console.log('Cities in DB:', cities);

  } catch (error) {
    console.error('Error during DB inspection:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
