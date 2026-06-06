import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching profiles...');
  const profiles = await prisma.profiles.findMany({
    take: 20
  });

  console.log('--- PROFILES ---');
  profiles.forEach(p => {
    console.log(`ID: ${p.id}, Nickname: ${p.nickname}, raw:`, JSON.stringify(p));
  });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
