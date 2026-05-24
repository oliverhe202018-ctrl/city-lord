import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Updating Territory Owner ---');
  const targetId = 'terr_0172b25b5755460d83ef03e3';
  const ownerId = 'a4e43427-4a7d-45a8-97e5-c095070d7f7e';
  const clubId = 'd212a29a-3b76-4452-aa8f-6b6aa0bec1d3';
  const faction = 'Blue';

  try {
    const updated = await prisma.territories.update({
      where: { id: targetId },
      data: {
        owner_id: ownerId,
        owner_club_id: clubId,
        owner_faction: faction,
        health: 1000,
        current_hp: 1000,
        max_hp: 1000
      }
    });
    console.log(`Success! Updated owner for territory: ${updated.id}`);
  } catch (err: any) {
    console.error('Update failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
