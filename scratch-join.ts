import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Testing join query...');
  const users = await prisma.$queryRawUnsafe<any[]>(
    `SELECT p.id, p.nickname, u.email, u.phone 
     FROM public.profiles p 
     LEFT JOIN auth.users u ON p.id = u.id 
     LIMIT 5`
  );

  console.log('--- JOIN RESULTS ---');
  users.forEach(u => {
    console.log(`ID: ${u.id}, Nickname: ${u.nickname}, Email: ${u.email}, Phone: ${u.phone}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
