const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const shape = { geometry: { type: "Point", coordinates: [0,0] } };
        const geojsonStr = JSON.stringify(shape.geometry);
        console.log("Testing dual parameter inference...");
        // Emulate the exact settlement.ts statement
        const res = await prisma.$executeRaw(Prisma.sql`
            SELECT 
                ST_GeomFromGeoJSON(${geojsonStr}::text) as g, 
                ${shape.geometry}::jsonb as j
        `);
        console.log("Success:", res);
    } catch (e) {
        console.error("Error:", e.message);
    }
}
main().finally(() => prisma.$disconnect());
