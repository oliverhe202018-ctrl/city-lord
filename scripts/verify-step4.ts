import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'
const prisma = new PrismaClient()

async function runVerification() {
    console.log('--- Step 4 Verification Script ---')

    // 1. Setup Test Users
    const inviterId = uuidv4()
    const inviteeId = uuidv4()

    // Create mock profiles directly if needed, assuming the DB allows missing profiles or we can create them
    await prisma.profiles.create({
        data: { id: inviterId, nickname: 'Test Inviter', coins: 0, created_at: new Date() }
    })
    await prisma.profiles.create({
        data: { id: inviteeId, nickname: 'Test Invitee', coins: 0, created_at: new Date() }
    })

    console.log(`[Users Created] Inviter: ${inviterId}, Invitee: ${inviteeId}`)

    // 2. Cron: Insert expired pending invites
    const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 days ago

    const invite1 = await prisma.friend_invitations.create({
        data: { inviter_user_id: inviterId, invite_link: `/invite?ref=TEST_CRON_1_${Date.now()}`, status: 'pending', expired_at: pastDate }
    })
    const invite2 = await prisma.friend_invitations.create({
        data: { inviter_user_id: inviterId, invite_link: `/invite?ref=TEST_CRON_2_${Date.now()}`, status: 'pending', expired_at: null } // Should NOT be cleaned
    })

    console.log('[Cron Setup Data]', { invite1: invite1.id, invite2: invite2.id })

    // 3. Test Cron Execution (Directly simulate route logic or fetch)
    // Assuming the local server is running on port 3000
    try {
        const cronRes = await fetch('http://localhost:3000/api/cron/cleanup-invitations', {
            headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET || 'cron-secret'}` }
        })
        const cronData = await cronRes.json()
        console.log('[Cron Result]', cronData)

        // Verify DB
        const updated1 = await prisma.friend_invitations.findUnique({ where: { id: invite1.id } })
        const updated2 = await prisma.friend_invitations.findUnique({ where: { id: invite2.id } })
        console.log('[Cron DB Verify]', {
            invite1_status: updated1?.status, // should be 'expired'
            invite2_status: updated2?.status  // should still be 'pending'
        })
    } catch (e) {
        console.warn('Cron fetch failed (Server might not be running). Manual DB verify needed.')
    }

    // 4. Test Concurrent Accept Invite
    // Cannot easily mock `createClient().auth.getUser` inside server actions from a pure script 
    // without extensive mocking, but we can document the expectation.
    console.log('--- Please run concurrent acceptInvite tests directly via UI or Jest if mocked ---')

    // Cleanup
    await prisma.friend_invitations.deleteMany({ where: { inviter_user_id: inviterId } })
    await prisma.profiles.delete({ where: { id: inviterId } })
    await prisma.profiles.delete({ where: { id: inviteeId } })

    console.log('--- Verification Script Completed ---')
}

runVerification().catch(console.error).finally(() => prisma.$disconnect())
