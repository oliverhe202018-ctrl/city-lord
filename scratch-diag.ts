import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const runId = 'f9615839-6939-46cc-b1d6-b8c97a502496';
  console.log(`Fetching eventsLog for run ${runId}`);
  const run = await prisma.runs.findUnique({
    where: { id: runId },
    select: { eventsLog: true }
  });

  if (!run) {
    console.error('Run not found');
    return;
  }
  
  if (Array.isArray(run.eventsLog)) {
      const diagEvent = run.eventsLog.find((e: any) => e.eventId && e.eventId.startsWith('diag_'));
      if (diagEvent) {
          console.log(`Diag event:`, JSON.stringify(diagEvent, null, 2));
      } else {
          console.log('No diag event found');
      }
  } else {
      console.log('eventsLog is not an array or is empty', run.eventsLog);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
