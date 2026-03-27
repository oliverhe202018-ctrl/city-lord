import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
    const GHOST_NPC_ID = '00000000-0000-0000-0000-000000000001';
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    console.log('Checking for territories older than:', sevenDaysAgo.toISOString());

    const totalCount = await prisma.territories.count();
    console.log('Total territories:', totalCount);

    const matchCount = await prisma.territories.count({
        where: {
            last_maintained_at: { lt: sevenDaysAgo },
            owner_id: { not: GHOST_NPC_ID },
        }
    });
    console.log('Territories matching criteria (last_maintained_at < 7d):', matchCount);

    const nullCount = await prisma.territories.count({
        where: {
            last_maintained_at: null,
            owner_id: { not: GHOST_NPC_ID },
        }
    });
    console.log('Territories with null last_maintained_at:', nullCount);

    const npcCount = await prisma.territories.count({
        where: {
            owner_id: GHOST_NPC_ID
        }
    });
    console.log('Territories already owned by NPC:', npcCount);

    process.exit(0);
}

check().catch(err => {
    console.error(err);
    process.exit(1);
});
