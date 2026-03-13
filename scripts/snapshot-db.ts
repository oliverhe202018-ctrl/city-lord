import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    console.log("Starting DB Snapshot...");
    try {
        const territories = await prisma.territories.findMany();
        const events = await prisma.territory_events.findMany();
        
        fs.writeFileSync('snapshot_territories.json', JSON.stringify(territories, null, 2));
        fs.writeFileSync('snapshot_events.json', JSON.stringify(events, null, 2));
        
        console.log(`Snapshot complete. Saved ${territories.length} territories and ${events.length} events.`);
    } catch (e) {
        console.error("Snapshot failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
