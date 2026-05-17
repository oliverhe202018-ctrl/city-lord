import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result: any = await prisma.$queryRaw`
    SELECT pg_get_constraintdef(c.oid) 
    FROM pg_constraint c 
    JOIN pg_class t ON c.conrelid = t.oid 
    WHERE c.conname = 'check_valid_faction';
  `;
  console.log(result);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
