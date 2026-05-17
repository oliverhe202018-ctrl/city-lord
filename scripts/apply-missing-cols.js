require('dotenv').config();
const { Client } = require('pg');

async function main() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL,
    });
    try {
        await client.connect();
        console.log('Adding missing neutral_until column...');
        await client.query(`ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS neutral_until TIMESTAMPTZ;`);
        console.log('Added!');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.end();
    }
}

main();
