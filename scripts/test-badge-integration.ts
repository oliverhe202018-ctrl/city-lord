import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Direct import of the core functions instead of going through event bus
import { checkAndAwardBadges, awardBadgeAtomic } from '../lib/game-logic/achievement-core'

async function test() {
  console.log('🚀 Starting Badge Integration Test (Direct Mode)...')
  
  const testUserId = '00000000-0000-0000-0000-000000000001' 
  const testClubId = '00000000-0000-0000-0000-00000000000c'
  const testActivityId = '00000000-0000-0000-0000-00000000000a'

  console.log('🧹 Cleaning up old test data...')
  await prisma.notifications.deleteMany({ where: { user_id: testUserId } })
  await prisma.user_badges.deleteMany({ where: { user_id: testUserId } })
  await prisma.club_activity_registrations.deleteMany({ where: { user_id: testUserId } })
  await prisma.club_activities.deleteMany({ where: { club_id: testClubId } })
  await prisma.clubs.deleteMany({ where: { id: testClubId } })
  await prisma.profiles.deleteMany({ where: { id: testUserId } })

  console.log('🏗️ Creating test entities...')
  await prisma.profiles.create({
    data: { id: testUserId, nickname: 'TestRunner' }
  })

  await prisma.clubs.create({
    data: {
      id: testClubId,
      name: 'Test integration Club',
      owner_id: testUserId
    }
  })

  await prisma.club_activities.create({
    data: {
      id: testActivityId,
      club_id: testClubId,
      title: 'Initial Test Activity',
      created_by: testUserId,
      start_time: new Date(),
      end_time: new Date(Date.now() + 3600000)
    }
  })

  // Ensure badges exist in DB
  const badgeCodes = ['first-activity', 'activity-enthusiast', 'activity-top3']
  for (const code of badgeCodes) {
    await prisma.badges.upsert({
      where: { code },
      update: {},
      create: { code, name: `Badge ${code}`, description: 'Test Badge' }
    })
  }

  // Create one completed activity registration
  await prisma.club_activity_registrations.create({
    data: {
      activity_id: testActivityId,
      user_id: testUserId,
      club_id: testClubId,
      status: 'completed'
    }
  })

  console.log('✅ Setup complete.')

  // --- TEST 1: Direct awardBadgeAtomic ---
  console.log('\n--- TEST 1: Direct awardBadgeAtomic("first-activity") ---')
  const directResult = await awardBadgeAtomic(testUserId, 'first-activity')
  console.log('Result:', JSON.stringify(directResult, null, 2))

  if (directResult.status === 'awarded') {
    console.log('✅ TEST 1 PASSED: first-activity awarded directly.')
  } else {
    console.error(`❌ TEST 1 FAILED: status=${directResult.status}`)
  }

  // --- TEST 2: Idempotency ---
  console.log('\n--- TEST 2: Idempotency (awarding same badge again) ---')
  const idempResult = await awardBadgeAtomic(testUserId, 'first-activity')
  console.log('Result:', JSON.stringify(idempResult, null, 2))

  if (idempResult.status === 'already_owned') {
    console.log('✅ TEST 2 PASSED: Idempotency works.')
  } else {
    console.error(`❌ TEST 2 FAILED: expected already_owned, got ${idempResult.status}`)
  }

  // --- TEST 3: checkAndAwardBadges via ACTIVITY_COMPLETED ---
  console.log('\n--- TEST 3: checkAndAwardBadges("ACTIVITY_COMPLETED") ---')
  // First delete the badge so it can be re-awarded
  await prisma.user_badges.deleteMany({ where: { user_id: testUserId } })
  const results = await checkAndAwardBadges(testUserId, 'ACTIVITY_COMPLETED', { isTopThree: true })
  console.log('Results:', JSON.stringify(results, null, 2))

  const firstBadge = results.find(r => r.badgeCode === 'first-activity')
  const top3Badge = results.find(r => r.badgeCode === 'activity-top3')
  
  if (firstBadge?.status === 'awarded') {
    console.log('✅ first-activity awarded via checkAndAwardBadges.')
  } else {
    console.error('❌ first-activity NOT awarded via checkAndAwardBadges.')
  }

  if (top3Badge?.status === 'awarded') {
    console.log('✅ activity-top3 awarded via checkAndAwardBadges.')
  } else {
    console.error('❌ activity-top3 NOT awarded via checkAndAwardBadges.')
  }

  // --- TEST 4: activity-enthusiast (threshold 5) ---
  console.log('\n--- TEST 4: activity-enthusiast (adding 4 more completions) ---')
  for (let i = 2; i <= 5; i++) {
    const extraActId = `00000000-0000-0000-0000-0000000000${i}a`
    await prisma.club_activities.create({
      data: {
        id: extraActId,
        club_id: testClubId,
        title: `Extra Activity ${i}`,
        created_by: testUserId,
        start_time: new Date(),
        end_time: new Date(Date.now() + 3600000)
      }
    })
    await prisma.club_activity_registrations.create({
      data: {
        activity_id: extraActId,
        user_id: testUserId,
        club_id: testClubId,
        status: 'completed'
      }
    })
  }
  const enthResults = await checkAndAwardBadges(testUserId, 'ACTIVITY_COMPLETED', { isTopThree: false })
  console.log('Results:', JSON.stringify(enthResults, null, 2))

  const enthBadge = enthResults.find(r => r.badgeCode === 'activity-enthusiast')
  if (enthBadge?.status === 'awarded') {
    console.log('✅ activity-enthusiast awarded.')
  } else {
    console.error('❌ activity-enthusiast NOT awarded.')
  }

  // --- Verification: Notifications ---
  console.log('\n--- Notification Verification ---')
  const notifications = await prisma.notifications.findMany({
    where: { user_id: testUserId, type: 'badge' }
  })
  console.log(`🔔 Notifications created: ${notifications.length}`)

  // --- Teardown ---
  console.log('\n🧹 Tearing down test data...')
  await prisma.notifications.deleteMany({ where: { user_id: testUserId } })
  await prisma.user_badges.deleteMany({ where: { user_id: testUserId } })
  await prisma.club_activity_registrations.deleteMany({ where: { user_id: testUserId } })
  await prisma.club_activities.deleteMany({ where: { club_id: testClubId } })
  await prisma.clubs.deleteMany({ where: { id: testClubId } })
  await prisma.profiles.delete({ where: { id: testUserId } })

  console.log('🎉 Test run complete!')
}

test()
  .catch(err => {
    console.error('❌ Test FAILED:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
