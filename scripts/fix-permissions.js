const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Applying permissions to schema public...');

    try {
        // 1. Grant usage on public schema
        // Note: We use executeRawUnsafe because these are system commands
        await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;`);
        console.log('✓ Granted USAGE on schema public');

        // 2. Grant all privileges on all TABLES in public schema
        await prisma.$executeRawUnsafe(`GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;`);
        console.log('✓ Granted ALL on ALL TABLES in schema public');

        // 3. Grant all privileges on all SEQUENCES in public schema
        await prisma.$executeRawUnsafe(`GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;`);
        console.log('✓ Granted ALL on ALL SEQUENCES in schema public');

        // 4. Grant all privileges on all FUNCTIONS in public schema
        await prisma.$executeRawUnsafe(`GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;`);
        console.log('✓ Granted ALL on ALL FUNCTIONS in schema public');

        // 5. Set default privileges for future objects
        await prisma.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;`);
        await prisma.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;`);
        await prisma.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;`);
        console.log('✓ Altered DEFAULT PRIVILEGES for future objects');

        console.log('\nPermissions fix completed successfully!');
    } catch (e) {
        console.error('Error applying permissions:', e);
        // Continue even if error, as some roles might not exist or already have permissions
        // But we exit with 1 to show failure
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
