const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env' });

async function main() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL,
    });

    try {
        console.log('Connecting to database via pg...');
        await client.connect();

        // 1. Read Migration
        const migrationPath = path.join(__dirname, '../supabase/migrations/20260310120000_phase2b1_infrastructure.sql');
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Executing Infrastructure Migration...');
        await client.query(migrationSql);
        console.log('Migration Applied Successfully.');

        // 2. Read Baseline Population
        const baselinePath = path.join(__dirname, '../supabase/scripts/2b1_baseline_population.sql');
        const baselineSql = fs.readFileSync(baselinePath, 'utf8');

        console.log('Executing Baseline Population...');
        await client.query(baselineSql);
        console.log('Baseline Population Applied Successfully.');

        // 3. Verify Baseline
        const clubs = await client.query('SELECT * FROM club_territory_stats LIMIT 5;');
        console.log('Sample club_territory_stats:\n', JSON.stringify(clubs.rows, null, 2));

        const factions = await client.query('SELECT * FROM faction_territory_stats LIMIT 5;');
        console.log('Sample faction_territory_stats:\n', JSON.stringify(factions.rows, null, 2));

        const cursors = await client.query('SELECT * FROM worker_cursors;');
        console.log('Worker Cursors:\n', JSON.stringify(cursors.rows, null, 2));

    } catch (error) {
        console.error('Error applying 2B-1:', error);
    } finally {
        await client.end();
    }
}

main();
