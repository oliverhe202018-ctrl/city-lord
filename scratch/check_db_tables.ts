import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const tables = await prisma.$queryRaw<any[]>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    console.log('--- DATABASE TABLES ---');
    console.log(tables.map(t => t.table_name));
    console.log('-----------------------');
  } catch (err) {
    console.error('Error querying tables:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
