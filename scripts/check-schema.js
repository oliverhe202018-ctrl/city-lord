require('dotenv').config();
const { Client } = require('pg');

async function main() {
    const client = new Client({ connectionString: process.env.DIRECT_URL });
    try {
        await client.connect();

        const q = `
            SELECT table_name, column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name IN (
                'territory_hp_logs', 'territory_owner_change_logs', 'territories',
                'messages', 'room_messages', 'device_tokens',
                'territory_events', 'club_territory_stats', 'faction_territory_stats', 
                'worker_cursors', 'territory_reward_penalties'
            )
        `;
        const res = await client.query(q);
        const map = {};
        for (const r of res.rows) {
            if (!map[r.table_name]) map[r.table_name] = [];
            map[r.table_name].push(r.column_name);
        }
        console.log(JSON.stringify(map, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
main();
