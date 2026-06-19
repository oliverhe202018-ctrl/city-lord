import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/v1/social/read
 * Mark social interactions as read
 * Body: { interactionIds?: { type: 'LIKE' | 'COMMENT', id: string }[], postId?: string }
 */
export async function POST(request: NextRequest) {
    try {
        // Auth
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json(
                { success: false, error: { code: 403, message: 'Unauthorized' } },
                { status: 401 }
            )
        }

        // Parse body
        const body = await request.json()
        const { interactionIds, postId } = body

        if (interactionIds && Array.isArray(interactionIds) && interactionIds.length > 0) {
            // Mark specific interactions as read
            const likeIds = interactionIds.filter((i: any) => i.type === 'LIKE').map((i: any) => i.id)
            const commentIds = interactionIds.filter((i: any) => i.type === 'COMMENT').map((i: any) => i.id)

            const tasks = []
            if (likeIds.length > 0) {
                tasks.push(prisma.post_likes.updateMany({
                    where: { id: { in: likeIds } },
                    data: { is_read: true }
                }))
            }
            if (commentIds.length > 0) {
                tasks.push(prisma.post_comments.updateMany({
                    where: { id: { in: commentIds } },
                    data: { is_read: true }
                }))
            }
            if (tasks.length > 0) await Promise.all(tasks)

        } else if (postId) {
            // Mark all unread interactions for a specific post
            const post = await prisma.posts.findUnique({
                where: { id: postId },
                select: { user_id: true }
            })

            if (post && post.user_id === user.id) {
                await Promise.all([
                    prisma.post_likes.updateMany({
                        where: { post_id: postId, is_read: false, user_id: { not: user.id } },
                        data: { is_read: true }
                    }),
                    prisma.post_comments.updateMany({
                        where: { post_id: postId, is_read: false, user_id: { not: user.id } },
                        data: { is_read: true }
                    })
                ])
            }
        } else {
            // Global fallback: Mark all unread interactions for the user's posts as read
            const userPosts = await prisma.posts.findMany({
                where: { user_id: user.id },
                select: { id: true }
            })
            const postIds = userPosts.map((p: any) => p.id)

            if (postIds.length > 0) {
                await Promise.all([
                    prisma.post_likes.updateMany({
                        where: { post_id: { in: postIds }, is_read: false, user_id: { not: user.id } },
                        data: { is_read: true }
                    }),
                    prisma.post_comments.updateMany({
                        where: { post_id: { in: postIds }, is_read: false, user_id: { not: user.id } },
                        data: { is_read: true }
                    })
                ])
            }
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('[POST /api/v1/social/read] Error:', error)
        return NextResponse.json(
            { success: false, error: { code: 500, message: 'Failed to update read status due to network or database error.' } },
            { status: 500 }
        )
    }
}
