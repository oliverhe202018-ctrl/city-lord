import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching 5 most recent runs...');
  const runs = await prisma.runs.findMany({
    orderBy: { created_at: 'desc' },
    take: 5
  });

  console.log('--- RUNS ---');
  runs.forEach(r => {
    console.log(`Run ID: ${r.id}, Status: ${r.status}, new_terr: ${r.new_territories_count}, ` +
      `is_valid: ${r.is_valid}, polygons: ${r.polygons ? 'YES' : 'NO'}`);
  });

  if (runs.length > 0) {
    const recentRun = runs[0];
    console.log(`\nFetching territories for run ${recentRun.id}...`);
    const territories = await prisma.territories.findMany({
      where: { source_run_id: recentRun.id }
    });
    console.log(`Found ${territories.length} territories:`);
    if(territories.length > 0) {
       console.log(JSON.stringify(territories.slice(0, 2), null, 2));
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
