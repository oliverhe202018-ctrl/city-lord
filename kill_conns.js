const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Terminating idle connections...");
        await prisma.$executeRawUnsafe(`
            SELECT pg_terminate_backend(pid) 
            FROM pg_stat_activity 
            WHERE pid <> pg_backend_pid() 
            AND state in ('idle', 'idle in transaction');
        `);
        console.log("Killed all other idle connections");
    } catch (e) {
        console.error("Error killing connections:", e.message);
    }
}
main().finally(() => prisma.$disconnect());
