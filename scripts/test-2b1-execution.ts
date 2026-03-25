import { PrismaClient } from '@prisma/client'
import { TerritoryStatsAggregatorService } from '../lib/services/territory-stats-aggregator'
import { TerritoryReconcileService } from '../lib/services/territory-reconcile'
import { H3_TILE_AREA_KM2 } from '../lib/constants/territory'

const prisma = new PrismaClient()

async function main() {
    try {
        console.log('--- Phase 2B-1 Test Suite ---')

        // 1. Inject Test Events
        console.log('1. Injecting 3 CLAIM events for Club A and Faction Bio...')
        const dummyClub1 = '11111111-1111-1111-1111-111111111111'
        const dummyClub2 = '22222222-2222-2222-2222-222222222222'

        // First ensure clubs exist to satisfy FK constraints
        await prisma.$executeRawUnsafe(`
      INSERT INTO clubs (id, name, status) VALUES 
      ('11111111-1111-1111-1111-111111111111', 'Club Test A', 'active'),
      ('22222222-2222-2222-2222-222222222222', 'Club Test B', 'active')
      ON CONFLICT (id) DO NOTHING;
    `)

        await prisma.$executeRawUnsafe(`
      INSERT INTO profiles (id, created_at, updated_at) VALUES 
      ('11111111-1111-1111-1111-111111111111', NOW(), NOW()),
      ('22222222-2222-2222-2222-222222222222', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `)

        await prisma.$executeRawUnsafe(`
      INSERT INTO territory_events (territory_id, event_type, new_club_id, new_faction, created_at)
      VALUES 
      ('hex_test_01', 'CLAIM', '11111111-1111-1111-1111-111111111111', 'bio', NOW()),
      ('hex_test_02', 'CLAIM', '11111111-1111-1111-1111-111111111111', 'bio', NOW()),
      ('hex_test_03', 'CLAIM', '22222222-2222-2222-2222-222222222222', 'cyberpunk', NOW());
    `)

        // In parallel, update actual territories to reflect this for reconcile to test against
        await prisma.$executeRawUnsafe(`
      INSERT INTO territories (id, city_id, owner_id, owner_club_id, owner_faction)
      VALUES 
      ('hex_test_01', 'city_test', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'bio'),
      ('hex_test_02', 'city_test', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'bio'),
      ('hex_test_03', 'city_test', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'cyberpunk')
      ON CONFLICT (id) DO UPDATE SET owner_club_id = EXCLUDED.owner_club_id, owner_faction = EXCLUDED.owner_faction;
    `)

        console.log('2. Running Stats Worker (Batch 1)...')
        let result = await TerritoryStatsAggregatorService.processNextBatch()
        console.log('Worker Result:', result)

        let clubStats = await prisma.$queryRaw`SELECT * FROM club_territory_stats WHERE club_id IN (${dummyClub1}::uuid, ${dummyClub2}::uuid)`
        console.log('Club Stats after Worker:', clubStats)

        console.log('3. Running Nightly Reconcile (Expect 0 drift)...')
        let recResult = await TerritoryReconcileService.runReconcile()
        console.log('Reconcile Result:', recResult)

        console.log('4. Simulating Drift (Changing Territory 1 manually without Event)...')
        await prisma.$executeRawUnsafe(`
      UPDATE territories SET owner_club_id = '22222222-2222-2222-2222-222222222222' WHERE id = 'hex_test_01';
        `)

        console.log('5. Running Nightly Reconcile again (Expect 2 fixed drifts: A loses 1, B gains 1)...')
        recResult = await TerritoryReconcileService.runReconcile()
        console.log('Reconcile Result:', recResult)

        clubStats = await prisma.$queryRaw`SELECT * FROM club_territory_stats WHERE club_id IN (${dummyClub1}::uuid, ${dummyClub2}::uuid) ORDER BY club_id ASC`
        console.log('Club Stats after Reconcile:', clubStats)

        const events = await prisma.$queryRaw`SELECT * FROM territory_events WHERE event_type = 'RECONCILE_ADJUST' ORDER BY id DESC LIMIT 2`
        console.log('Audit Events Generated:', events)

    } catch (error) {
        console.error('Test Suite Error:', error)
    } finally {
        await prisma.$disconnect()
    }
}

main()
