const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const runs = await prisma.runs.findMany({
    orderBy: { created_at: 'desc' },
    take: 10,
    select: { distance: true, duration: true, user_id: true }
  });
  console.log(JSON.stringify(runs, null, 2));
}

main().finally(() => prisma.$disconnect());
