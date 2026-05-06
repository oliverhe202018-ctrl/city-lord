import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const progress = await prisma.user_city_progress.findFirst();
    console.log("user_city_progress row:", progress);

    const club = await prisma.clubs.findFirst();
    console.log("club row:", club);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
