import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const subscription = await req.json()

        // Basic Zod validation can be added, but manual check for required fields
        if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
            return NextResponse.json({ error: 'Invalid subscription payload' }, { status: 400 })
        }

        await prisma.push_subscriptions.upsert({
            where: { endpoint: subscription.endpoint },
            update: {
                user_id: user.id,
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
                updated_at: new Date(),
                revoked_at: null,
            },
            create: {
                user_id: user.id,
                endpoint: subscription.endpoint,
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
            },
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Push subscribe error:', error)
        return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 })
    }
}
