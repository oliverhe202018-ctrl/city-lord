import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { targetId, activityType, action } = await req.json()
        // action: 'like' | 'unlike'

        if (!targetId || !activityType) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
        }

        if (action === 'unlike') {
            await prisma.activity_likes.deleteMany({
                where: {
                    user_id: user.id,
                    target_id: targetId,
                    activity_type: activityType
                }
            })
        } else {
            await prisma.activity_likes.upsert({
                where: {
                    user_id_activity_type_target_id: {
                        user_id: user.id,
                        target_id: targetId,
                        activity_type: activityType
                    }
                },
                create: {
                    user_id: user.id,
                    target_id: targetId,
                    activity_type: activityType
                },
                update: {}
            })
        }

        // Get new count
        const count = await prisma.activity_likes.count({
            where: {
                target_id: targetId,
                activity_type: activityType
            }
        })

        return NextResponse.json({ success: true, count })
    } catch (error) {
        console.error('Like error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
