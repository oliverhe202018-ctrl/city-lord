const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.profiles.findFirst({
      where: { nickname: '测q邮2515' }
  });
  if (!user) {
      console.log("User not found");
      return;
  }
  const runs = await prisma.runs.findMany({
    where: { user_id: user.id },
    orderBy: { created_at: 'desc' },
    take: 3,
    select: { id: true, distance: true, duration: true, area: true, created_at: true }
  });
  console.log(JSON.stringify(runs, null, 2));
}

main().finally(() => {
    prisma.$disconnect().catch(() => {});
});
