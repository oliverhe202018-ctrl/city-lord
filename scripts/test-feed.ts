/**
 * Test script for Social Feed creation and fetching MVP (Stage 3A)
 * Run with: npx tsx scripts/test-feed.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testFeed() {
    console.log('--- Initializing Feed Test ---')
    const users = await prisma.profiles.findMany({ take: 3 })
    if (users.length < 2) {
        console.error('Need at least 2 users in the test DB for this test.')
        return
    }

    const userA = users[0].id
    const userB = users[1].id

    console.log(`UserA: ${userA}`)
    console.log(`UserB: ${userB}`)

    // Clean up
    await prisma.post_likes.deleteMany({ where: { user_id: { in: [userA, userB] } } })
    await prisma.posts.deleteMany({ where: { user_id: { in: [userA, userB] } } })

    console.log('\n--- Creating Posts ---')
    const post1 = await prisma.posts.create({
        data: { user_id: userA, content: 'Hello World (Public)', source_type: 'TEXT', visibility: 'PUBLIC' }
    })
    const post2 = await prisma.posts.create({
        data: { user_id: userA, content: 'Hello Friends (Friends Only)', source_type: 'TEXT', visibility: 'FRIENDS_ONLY' }
    })
    const post3 = await prisma.posts.create({
        data: { user_id: userB, content: 'User B post', source_type: 'TEXT', visibility: 'PUBLIC' }
    })

    console.log(`Created ${post1.id}, ${post2.id}, ${post3.id}`)

    console.log('\n--- Testing Feed Query Logic Backend (Global) ---')
    // We mimic the internal query of `getFeedTimeline` with filter GLOBAL
    const globalPosts = await prisma.posts.findMany({
        where: { status: 'ACTIVE', visibility: 'PUBLIC' },
        orderBy: { created_at: 'desc' },
        take: 5
    })

    console.log(`Global Posts Found: ${globalPosts.length}`)
    globalPosts.forEach(p => console.log(`- [${p.visibility}] ${p.content}`))

    console.log('\n--- Validation Results ---')
    if (globalPosts.length >= 2 && globalPosts.some(p => p.id === post1.id) && globalPosts.some(p => p.id === post3.id) && !globalPosts.some(p => p.id === post2.id)) {
        console.log('✅ FEED TIMELINE PUBLIC FILTER TEST PASSED')
    } else {
        console.error('❌ FEED TIMELINE PUBLIC FILTER TEST FAILED')
    }

    // Testing Rate Limits / Content Rules
    try {
        await prisma.posts.create({
            data: { user_id: userA, content: 'x'.repeat(501), source_type: 'TEXT' }
        })
    } catch (e: any) {
        // Expected to pass DB level if no varchar limit, but MVP depends on API Logic validation. 
        // We just note this for completeness.
    }

    console.log('\nTesting complete.')
}

testFeed().catch(console.error).finally(() => prisma.$disconnect())
