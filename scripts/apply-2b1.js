const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Connecting to database...');

        // 1. Read Migration
        const migrationPath = path.join(__dirname, '../supabase/migrations/20260310120000_phase2b1_infrastructure.sql');
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Executing Infrastructure Migration...');
        // Split by semicolon and run separately, ignoring empty lines
        const statements = migrationSql.split(';').map(s => s.trim()).filter(s => s.length > 0);
        for (const stmt of statements) {
            console.log(`Executing snippet: ${stmt.substring(0, 50)}...`);
            await prisma.$executeRawUnsafe(stmt);
        }
        console.log('Migration Applied Successfully.');

        // 2. Read Baseline Population
        const baselinePath = path.join(__dirname, '../supabase/scripts/2b1_baseline_population.sql');
        const baselineSql = fs.readFileSync(baselinePath, 'utf8');

        console.log('Executing Baseline Population...');
        // The DO $$ block counts as a single statement, so it doesn't need splitting
        await prisma.$executeRawUnsafe(baselineSql);
        console.log('Baseline Population Applied Successfully.');

        // 3. Verify Baseline
        const clubs = await prisma.$queryRaw`SELECT * FROM club_territory_stats LIMIT 5;`;
        console.log('Sample club_territory_stats:', clubs);

        const factions = await prisma.$queryRaw`SELECT * FROM faction_territory_stats LIMIT 5;`;
        console.log('Sample faction_territory_stats:', factions);

        const cursors = await prisma.$queryRaw`SELECT * FROM worker_cursors`;
        console.log('Worker Cursors:', cursors);

    } catch (error) {
        console.error('Error applying 2B-1:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
