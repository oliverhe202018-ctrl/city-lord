require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL,
    });

    try {
        await client.connect();
        console.log('Connected to database via pg.');

        const migrationPath = path.join(__dirname, '../supabase/migrations/20260310121000_phase2b2a_abuse_penalties.sql');
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Executing Phase 2B-2A Migration...');
        await client.query(migrationSql);
        console.log('Migration Applied Successfully.');
    } catch (error) {
        console.error('Error applying 2B-2A:', error);
    } finally {
        await client.end();
    }
}

main();
