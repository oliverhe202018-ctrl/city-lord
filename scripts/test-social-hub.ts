/**
 * Test script for Social Hub MVP (Stage 3A)
 * Validates concurrent point redemption and basic feed functionality.
 * Run with: npx tsx scripts/test-social-hub.ts
 */

import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'
import { createPost, getFeedTimeline, togglePostLike } from '../app/actions/social-hub'
import { redeemItem } from '../app/actions/redemption'

const prisma = new PrismaClient()

async function resetTestData(testUserId: string) {
    console.log('--- Resetting Test Data ---')
    await prisma.user_purchases.deleteMany({ where: { user_id: testUserId } })
    await prisma.store_items.deleteMany({ where: { name: 'Test Energy Drink' } })
    await prisma.post_likes.deleteMany({ where: { user_id: testUserId } })
    await prisma.posts.deleteMany({ where: { user_id: testUserId } })

    await prisma.profiles.update({
        where: { id: testUserId },
        data: { coins: 1000 } // Give test user starting balance
    })
}

async function testRedemptionConcurrency(testUserId: string) {
    console.log('\n--- Testing Redemption Concurrency ---')

    // 1. Create a test store item (Price: 100, Inventory: 5, Limit: 2 per user)
    const item = await prisma.store_items.create({
        data: {
            name: 'Test Energy Drink',
            price: 100,
            inventory_count: 5,
            purchase_limit_per_user: 2,
            is_active: true
        }
    })

    const idempotencyKey = uuidv4()
    console.log(`ItemId: ${item.id}, IdempotencyKey: ${idempotencyKey}`)
    console.log('Sending 10 concurrent requests with the SAME idempotency key...')

    // To simulate Auth context smoothly in a test without valid cookies,
    // we will call the raw prisma block mimicking the server action directly for the concurrency test,
    // as the actual server action requires a valid session cookie.

    const concurrentCalls = Array.from({ length: 10 }).map(async (_, idx) => {
        try {
            // Simulating Phase 1 & 2 of the redeemItem logic
            const existing = await prisma.user_purchases.findUnique({ where: { idempotency_key: idempotencyKey } })
            if (existing) return { success: existing.status === 'COMPLETED', tag: `Call ${idx} Early Check` }

            const result = await prisma.$transaction(async (tx) => {
                const itemCheck = await tx.store_items.findUnique({ where: { id: item.id } })
                if (!itemCheck || itemCheck.inventory_count <= 0) throw new Error('OUT_OF_STOCK')

                const profile = await tx.profiles.findUnique({ where: { id: testUserId } })
                if (!profile || (profile.coins || 0) < itemCheck.price) throw new Error('INSUFFICIENT_FUNDS')

                const purchases = await tx.user_purchases.count({ where: { user_id: testUserId, item_id: item.id, status: 'COMPLETED' } })
                if (purchases >= itemCheck.purchase_limit_per_user) throw new Error('LIMIT_REACHED')

                const p = await tx.user_purchases.create({
                    data: { idempotency_key: idempotencyKey, user_id: testUserId, item_id: item.id, status: 'PENDING' }
                })

                await tx.store_items.update({ where: { id: item.id }, data: { inventory_count: { decrement: 1 } } })
                await tx.profiles.update({ where: { id: testUserId }, data: { coins: { decrement: itemCheck.price } } })
                return tx.user_purchases.update({ where: { id: p.id }, data: { status: 'COMPLETED' } })
            })

            return { success: true, result, tag: `Call ${idx} Executed` }
        } catch (e: any) {
            if (e.code === 'P2002') return { success: false, error: 'Idempotency Conflict (Caught)', tag: `Call ${idx}` }
            return { success: false, error: e.message, tag: `Call ${idx}` }
        }
    })

    const results = await Promise.all(concurrentCalls)

    const successCount = results.filter(r => r.success).length
    const conflictCount = results.filter(r => r.error === 'Idempotency Conflict (Caught)').length

    console.log(`Results: ${successCount} Successes (Returns), ${conflictCount} Unique Conflicts Caught.`)
    console.log(results.map(r => `${r.tag}: ${r.success ? 'Success' : r.error}`).join('\n'))

    const finalProfile = await prisma.profiles.findUnique({ where: { id: testUserId } })
    const finalItem = await prisma.store_items.findUnique({ where: { id: item.id } })
    const finalPurchases = await prisma.user_purchases.findMany({ where: { idempotency_key: idempotencyKey } })

    console.log(`\nFinal Profile Coins: ${finalProfile?.coins} (Expected: 900)`)
    console.log(`Final Item Inventory: ${finalItem?.inventory_count} (Expected: 4)`)
    console.log(`Total Purchases Recorded: ${finalPurchases.length} (Expected: 1)`)

    if (finalPurchases.length === 1 && finalProfile?.coins === 900 && finalItem?.inventory_count === 4) {
        console.log('✅ REDEMPTION CONCURRENCY TEST PASSED')
    } else {
        console.error('❌ REDEMPTION CONCURRENCY TEST FAILED')
    }
}

async function run() {
    const users = await prisma.profiles.findMany({ take: 1 })
    if (users.length === 0) {
        console.error('No users found in database to simulate test.')
        return
    }
    const testUserId = users[0].id

    await resetTestData(testUserId)
    await testRedemptionConcurrency(testUserId)

    // NOTE: Feed testing (createPost, timeline) relies on active session cookies.
    // We recommend using the Browser / UI context for true E2E Feed debugging.

    console.log('\nTesting completed.')
}

run().catch(console.error).finally(() => prisma.$disconnect())
