const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
    const sql = fs.readFileSync('supabase/migrations/20260310200000_phase2b2b_exit_purge.sql', 'utf8');

    try {
        console.log('Executing migration via Prisma...');
        // Split the SQL into individual statements if needed or execute raw directly
        // PostgreSQL usually supports executing multiple statements in one query
        await prisma.$executeRawUnsafe(sql);
        console.log('Migration applied successfully.');
    } catch (error) {
        console.error('Error applying migration:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
