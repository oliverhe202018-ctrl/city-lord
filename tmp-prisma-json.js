const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const jsonStr = '{"type":"Point","coordinates":[0,0]}';
        // Test cases:
        console.log("Testing ::jsonb");
        const res1 = await prisma.$executeRaw(Prisma.sql`SELECT ${jsonStr}::jsonb as j`);
        console.log("Success:", res1);
    } catch (e) {
        console.error("Error 1:", e.message);
    }
    
    try {
        const jsonStr = '{"type":"Point","coordinates":[0,0]}';
        console.log("Testing CAST(... AS jsonb)");
        const res2 = await prisma.$executeRaw(Prisma.sql`SELECT CAST(${jsonStr} AS jsonb) as j`);
        console.log("Success:", res2);
    } catch (e) {
        console.error("Error 2:", e.message);
    }

    try {
        const jsonObj = { type: "Point", coordinates: [0,0] };
        console.log("Testing pure object binding");
        const res3 = await prisma.$executeRaw(Prisma.sql`SELECT ${jsonObj}::jsonb as j`);
        console.log("Success:", res3);
    } catch (e) {
        console.error("Error 3:", e.message);
    }
}
main().finally(() => prisma.$disconnect());
