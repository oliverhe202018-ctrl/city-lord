import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { targetId, activityType, content } = await req.json()

        if (!targetId || !activityType || !content?.trim()) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
        }

        const comment = await prisma.activity_comments.create({
            data: {
                user_id: user.id,
                target_id: targetId,
                activity_type: activityType,
                content: content.trim()
            }
        })

        return NextResponse.json({ success: true, comment })
    } catch (error) {
        console.error('Comment error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const targetId = searchParams.get('targetId')
        const activityType = searchParams.get('activityType')

        if (!targetId || !activityType) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
        }

        const comments = await prisma.activity_comments.findMany({
            where: {
                target_id: targetId,
                activity_type: activityType
            },
            orderBy: { created_at: 'desc' },
            include: {
                profiles: {
                    select: {
                        nickname: true,
                        avatar_url: true,
                        level: true
                    }
                }
            }
        })

        return NextResponse.json({ comments })
    } catch (error) {
        console.error('Fetch comment error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
