import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    console.log("Starting Raw DB Snapshot...");
    try {
        const territories: any[] = await prisma.$queryRawUnsafe(`SELECT row_to_json(t) as result FROM territories t`);
        fs.writeFileSync('snapshot_territories_raw.json', JSON.stringify(territories.map(r => r.result), null, 2));
        
        try {
            const events: any[] = await prisma.$queryRawUnsafe(`SELECT row_to_json(t) as result FROM territory_events t`);
            fs.writeFileSync('snapshot_events_raw.json', JSON.stringify(events.map(r => r.result), null, 2));
        } catch(e) {}

        console.log(`Snapshot complete. Saved ${territories.length} territories.`);
    } catch (e) {
        console.error("Snapshot failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
