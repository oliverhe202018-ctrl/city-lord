require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');

async function main() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL,
    });
    try {
        await client.connect();
        const res = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'territories'`);
        const columns = res.rows.map(r => r.column_name);
        fs.writeFileSync('scripts/db-cols.json', JSON.stringify(columns, null, 2));
        console.log('Saved to db-cols.json');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.end();
    }
}

main();
