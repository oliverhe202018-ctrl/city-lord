const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });

async function main() {
    await client.connect();
    console.log("Connected to DB natively.");
    
    // Dump territories
    const { rows: tRows } = await client.query('SELECT * FROM territories');
    fs.writeFileSync('snapshot_territories_raw.json', JSON.stringify(tRows, null, 2));
    
    // Dump events
    let eRows = [];
    try {
        const res = await client.query('SELECT * FROM territory_events');
        eRows = res.rows;
    } catch(e) {}
    fs.writeFileSync('snapshot_events_raw.json', JSON.stringify(eRows, null, 2));

    console.log(`Snapshot saved: ${tRows.length} territories, ${eRows.length} events.`);
    
    await client.end();
}
main().catch(console.error);
