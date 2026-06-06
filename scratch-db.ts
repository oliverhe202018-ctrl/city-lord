import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Querying auth.users...');
  const users = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, email, phone FROM auth.users LIMIT 50`
  );

  console.log('--- AUTH USERS ---');
  users.forEach(u => {
    console.log(`ID: ${u.id}, Email: ${u.email}, Phone: ${u.phone}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
