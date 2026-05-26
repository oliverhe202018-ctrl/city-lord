import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Query columns info
    const cols = await prisma.$queryRaw<any[]>`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'territories'
    `;
    console.log('--- TERRITORIES COLUMNS ---');
    cols.forEach(c => {
      console.log(`${c.column_name}: ${c.data_type} (nullable=${c.is_nullable}, default=${c.column_default})`);
    });

    // Query triggers info
    const triggers = await prisma.$queryRaw<any[]>`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'territories'
    `;
    console.log('--- TERRITORIES TRIGGERS ---');
    triggers.forEach(t => {
      console.log(`${t.trigger_name}: ${t.event_manipulation} -> ${t.action_statement}`);
    });
  } catch (err) {
    console.error('Error querying territories schema:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
