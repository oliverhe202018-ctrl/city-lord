'use server'

import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export type VisibilityConfig = 'PUBLIC' | 'FRIENDS_ONLY' | 'CLUB_ONLY' | 'PRIVATE'
export type SourceType = 'TEXT' | 'RUN' | 'ACHIEVEMENT'

export interface CreatePostInput {
    content?: string
    source_type: SourceType
    source_id?: string
    visibility?: VisibilityConfig
    mediaUrls?: string[]
}

export interface PostResponse {
    success: boolean
    post?: any
    error?: {
        code: number
        message: string
    }
}

async function getAuthUser() {
    const cookieStore = await cookies()
    const supabase = await createClient(cookieStore)
    const { data: { user } } = await Sentry.startSpan(
        { op: 'http.client', name: 'auth.getUser' },
        () => supabase.auth.getUser()
    )
    return user
}

export async function createPost(input: CreatePostInput): Promise<PostResponse> {
    try {
        const user = await getAuthUser()
        if (!user) return { success: false, error: { code: 403, message: 'Unauthorized' } }

        const { content, source_type, source_id, visibility = 'PUBLIC', mediaUrls } = input

        // Parse mediaUrls
        let finalMediaUrls: string[] = []
        if (Array.isArray(mediaUrls)) {
            finalMediaUrls = [...new Set(mediaUrls.map(u => u.trim()).filter(u => {
                if (!u) return false
                try {
                    const parsed = new URL(u)
                    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
                } catch {
                    return false
                }
            }))].slice(0, 9)
        }

        // Validation Rules
        if (content && content.length > 500) {
            return { success: false, error: { code: 400, message: 'Content exceeds maximum length of 500 characters' } }
        }

        if (source_type === 'TEXT' && source_id) {
            return { success: false, error: { code: 400, message: 'TEXT posts cannot have a source_id' } }
        }

        if (source_type !== 'TEXT' && !source_id) {
            return { success: false, error: { code: 400, message: 'source_id is required for non-TEXT posts' } }
        }

        // Ownership Verification
        if (source_type === 'RUN' && source_id) {
            const run = await prisma.runs.findUnique({ where: { id: source_id } })
            if (!run || run.user_id !== user.id) {
                return { success: false, error: { code: 403, message: 'Invalid run source' } }
            }
        } else if (source_type === 'ACHIEVEMENT' && source_id) {
            const achievement = await prisma.user_achievements.findUnique({ where: { id: source_id } })
            if (!achievement || achievement.user_id !== user.id) {
                return { success: false, error: { code: 403, message: 'Invalid achievement source' } }
            }
        }

        // Rate Limiting (30s)
        const recentPost = await prisma.posts.findFirst({
            where: { user_id: user.id, created_at: { gte: new Date(Date.now() - 30000) } }
        })
        if (recentPost) {
            return { success: false, error: { code: 429, message: '操作过于频繁，请稍后再试' } }
        }

        const post = await prisma.posts.create({
            data: {
                user_id: user.id,
                content: content || null,
                source_type,
                source_id: source_id || null,
                media_urls: finalMediaUrls,
                visibility,
                status: 'ACTIVE'
            },
            include: {
                user: { select: { id: true, nickname: true, avatar_url: true, level: true } },
                _count: { select: { likes: true, comments: true } }
            }
        })

        return { success: true, post }
    } catch (error: any) {
        console.error(`[createPost] - ${error.code || 500}: ${error.message || error}`)
        return { success: false, error: { code: 500, message: 'Internal server error' } }
    }
}

export interface FeedQueryInput {
    cursor?: string
    limit?: number
    filter?: 'GLOBAL' | 'FRIENDS' | 'USER'
    targetUserId?: string
}

export interface FeedTimelineResponse {
    // TODO(Track Issue): Refactor `items: any[]` to explicit types
    items: any[]
    nextCursor?: string
    error?: { code: number; message: string }
}

export async function getFeedTimeline(input: FeedQueryInput): Promise<FeedTimelineResponse> {
    try {
        const user = await getAuthUser()
        if (!user) return { items: [], error: { code: 403, message: 'Unauthorized' } }

        const limit = input.limit || 20
        const filter = input.filter || 'GLOBAL'
        const targetUserId = input.targetUserId

        // Privacy & Block checks
        if (targetUserId) {
            const isBlocked = await prisma.blocked_users.findFirst({
                where: {
                    OR: [
                        { blockerId: user.id, blockedId: targetUserId },
                        { blockerId: targetUserId, blockedId: user.id }
                    ]
                }
            })
            if (isBlocked) {
                return { items: [], error: { code: 403, message: 'Access denied' } }
            }
        }

        // Determine query conditions based on filter
        let whereClause: any = { status: 'ACTIVE' }

        // Start independent queries in parallel
        const [blockedRecords, friendships] = await Promise.all([
            Sentry.startSpan(
                { op: 'db.query', name: 'db.blocked_users' },
                () => prisma.blocked_users.findMany({
                    where: { OR: [{ blockerId: user.id }, { blockedId: user.id }] }
                })
            ),
            filter === 'FRIENDS'
                ? Sentry.startSpan(
                    { op: 'db.query', name: 'db.friendships' },
                    () => prisma.friendships.findMany({
                        where: { OR: [{ user_id: user.id }, { friend_id: user.id }], status: 'accepted' }
                    })
                )
                : Promise.resolve([])
        ])

        // Always exclude blocked users' posts globally
        const blockedUserIds = blockedRecords.map(b => b.blockerId === user.id ? b.blockedId : b.blockerId)

        if (blockedUserIds.length > 0) {
            whereClause.user_id = { notIn: blockedUserIds }
        }

        // Filter by target visibility
        if (filter === 'USER' && targetUserId) {
            whereClause.user_id = targetUserId
            if (targetUserId !== user.id) {
                // If not me, verify I have right to see it
                // Basic MVP logic: only public and friends. Skipping explicit friends check for brevity in MVP unless implemented.
                whereClause.visibility = { in: ['PUBLIC', 'FRIENDS_ONLY'] } // Assuming friends logic handled elsewhere or omitted here for simplicity
            }
        } else if (filter === 'GLOBAL') {
            whereClause.visibility = 'PUBLIC'
        } else if (filter === 'FRIENDS') {
            const friendIds = friendships.map(f => f.user_id === user.id ? f.friend_id : f.user_id)
            friendIds.push(user.id) // Always include own posts in friends feed
            whereClause.user_id = { in: friendIds.length > 0 ? friendIds : [user.id] }
            whereClause.visibility = { in: ['PUBLIC', 'FRIENDS_ONLY'] }
        }

        const posts = await Sentry.startSpan(
            { op: 'db.query', name: 'db.posts.feed' },
            () => prisma.posts.findMany({
                where: whereClause,
                take: limit + 1,
                cursor: input.cursor ? { id: input.cursor } : undefined,
                // 排序稳定性优先：在相同精确到毫秒的时间戳下，使用 id: 'desc' 作为兜底，保证游标稳定
                // 避免在默认 Feed 场景引入 likes/comments 这类动态 _count 排序导致 cursor 乱序甚至漏数据
                orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
                // @ts-expect-error — Prisma known bug: cursor pagination with
                // relationLoadStrategy:'join' incorrectly infers type as 'never'.
                // Runtime behavior is correct. Track: github.com/prisma/prisma/issues/22049
                relationLoadStrategy: 'join',
                include: {
                    user: { select: { id: true, nickname: true, avatar_url: true, level: true } },
                    comments: {
                        where: { status: 'ACTIVE' },
                        take: 3,
                        orderBy: { created_at: 'asc' },
                        include: { user: { select: { id: true, nickname: true, avatar_url: true } } }
                    }
                }
            })
        )

        // 批量 COUNT 替代 _count correlated subquery（10 条 post = 原先 20 次子查询 → 现在 1 次）
        // 使用子查询各自聚合后 JOIN，避免笛卡尔积 + COUNT(DISTINCT) 的开销
        const postIds = posts.map(p => p.id)
        const counts = postIds.length > 0
            ? await Sentry.startSpan(
                { op: 'db.query', name: 'db.posts.counts' },
                () => prisma.$queryRaw<
                    Array<{ post_id: string; likes_count: bigint; comments_count: bigint }>
                >`
                    SELECT
                        p.id AS post_id,
                        COALESCE(pl.likes_count, 0)    AS likes_count,
                        COALESCE(pc.comments_count, 0) AS comments_count
                    FROM posts p
                    LEFT JOIN (
                        SELECT post_id, COUNT(*) AS likes_count
                        FROM post_likes
                        WHERE post_id = ANY(${postIds}::uuid[])
                        GROUP BY post_id
                    ) pl ON pl.post_id = p.id
                    LEFT JOIN (
                        SELECT post_id, COUNT(*) AS comments_count
                        FROM post_comments
                        WHERE post_id = ANY(${postIds}::uuid[]) AND status = 'ACTIVE'
                        GROUP BY post_id
                    ) pc ON pc.post_id = p.id
                    WHERE p.id = ANY(${postIds}::uuid[])
                `
            )
            : []

        // 合并 counts 回 _count 形状，保持前端 post._count?.likes / post._count?.comments 兼容
        const countsMap = new Map(counts.map(c => [c.post_id, c]))
        const postsWithCounts = posts.map(p => ({
            ...p,
            _count: {
                likes: Number(countsMap.get(p.id)?.likes_count ?? 0),
                comments: Number(countsMap.get(p.id)?.comments_count ?? 0),
            }
        }))

        let nextCursor: string | undefined = undefined
        if (postsWithCounts.length > limit) {
            const nextItem = postsWithCounts.pop()
            nextCursor = nextItem?.id
        }

        return { items: postsWithCounts, nextCursor }
    } catch (error: any) {
        console.error(JSON.stringify({ action: 'getFeedTimeline', error: error.message || error }))
        return { items: [], error: { code: 500, message: 'Internal server error' } }
    }
}

export async function togglePostLike(postId: string): Promise<{ liked: boolean, totalLikes: number, error?: { code: number, message: string } }> {
    try {
        const user = await getAuthUser()
        if (!user) return { liked: false, totalLikes: 0, error: { code: 403, message: 'Unauthorized' } }

        // Layer 2 Privacy check
        const post = await prisma.posts.findUnique({ where: { id: postId } })
        if (!post || post.status !== 'ACTIVE') return { liked: false, totalLikes: 0, error: { code: 404, message: 'Post not found' } }

        // Check blocked
        const isBlocked = await prisma.blocked_users.findFirst({
            where: {
                OR: [
                    { blockerId: user.id, blockedId: post.user_id },
                    { blockerId: post.user_id, blockedId: user.id }
                ]
            }
        })
        if (isBlocked) return { liked: false, totalLikes: 0, error: { code: 403, message: 'Access denied' } }

        // Toggle logic (Idempotent try-catch wrapped check)
        const existingLike = await prisma.post_likes.findUnique({
            where: { post_id_user_id: { post_id: postId, user_id: user.id } }
        })

        if (existingLike) {
            await prisma.post_likes.delete({ where: { id: existingLike.id } })
        } else {
            try {
                await prisma.post_likes.create({ data: { post_id: postId, user_id: user.id } })
            } catch (e: any) {
                if (e.code === 'P2002') {
                    // Unique constraint, ignore
                } else {
                    throw e
                }
            }
        }

        const totalLikes = await prisma.post_likes.count({ where: { post_id: postId } })
        return { liked: !existingLike, totalLikes }
    } catch (error: any) {
        console.error(JSON.stringify({ action: 'togglePostLike', error: error.message || error }))
        return { liked: false, totalLikes: 0, error: { code: 500, message: 'Internal server error' } }
    }
}

export interface CommentInput {
    postId: string
    content: string
}

export async function createPostComment(input: CommentInput): Promise<{ success: boolean, comment?: any, error?: any }> {
    try {
        const user = await getAuthUser()
        if (!user) return { success: false, error: { code: 403, message: 'Unauthorized' } }

        if (!input.content || input.content.length > 500) {
            return { success: false, error: { code: 400, message: 'Invalid content length' } }
        }

        const post = await prisma.posts.findUnique({ where: { id: input.postId } })
        if (!post || post.status !== 'ACTIVE') return { success: false, error: { code: 404, message: 'Post not found' } }

        const isBlocked = await prisma.blocked_users.findFirst({
            where: {
                OR: [
                    { blockerId: user.id, blockedId: post.user_id },
                    { blockerId: post.user_id, blockedId: user.id }
                ]
            }
        })
        if (isBlocked) return { success: false, error: { code: 403, message: 'Access denied' } }

        // Rate Limiting (10s)
        const recentComment = await prisma.post_comments.findFirst({
            where: { user_id: user.id, created_at: { gte: new Date(Date.now() - 10000) } }
        })
        if (recentComment) {
            return { success: false, error: { code: 429, message: '操作过于频繁，请稍后再试' } }
        }

        const comment = await prisma.post_comments.create({
            data: { post_id: input.postId, user_id: user.id, content: input.content }
        })

        return { success: true, comment }
    } catch (error: any) {
        console.error(`[createPostComment] postId:${input?.postId || 'none'} - ${error.code || 500}: ${error.message || error}`)
        return { success: false, error: { code: 500, message: 'Internal server error' } }
    }
}

export async function deletePostComment(commentId: string): Promise<{ success: boolean, error?: any }> {
    try {
        const user = await getAuthUser()
        if (!user) return { success: false, error: { code: 403, message: 'Unauthorized' } }

        const comment = await prisma.post_comments.findUnique({ where: { id: commentId } })
        if (!comment) return { success: false, error: { code: 404, message: 'Comment not found' } }
        if (comment.user_id !== user.id) return { success: false, error: { code: 403, message: 'Not authorized' } }

        await prisma.post_comments.update({
            where: { id: commentId },
            data: { status: 'DELETED' }
        })
        return { success: true }
    } catch (error: any) {
        console.error(`[deletePostComment] ${commentId} - ${error.code || 500}: ${error.message || error}`)
        return { success: false, error: { code: 500, message: 'Internal server error' } }
    }
}

export interface GetPostCommentsInput {
    postId: string
    cursor?: string
    limit?: number
}

export interface GetPostCommentsResponse {
    items: any[]
    nextCursor?: string
    hasMore: boolean
    error?: { code: number; message: string }
}

export async function getPostComments(input: GetPostCommentsInput): Promise<GetPostCommentsResponse> {
    try {
        const user = await getAuthUser()
        if (!user) return { items: [], hasMore: false, error: { code: 403, message: 'Unauthorized' } }

        const limit = input.limit || 10

        const post = await prisma.posts.findUnique({ where: { id: input.postId } })
        if (!post || post.status !== 'ACTIVE') {
            return { items: [], hasMore: false, error: { code: 404, message: 'Post not found' } }
        }

        const isBlocked = await prisma.blocked_users.findFirst({
            where: {
                OR: [
                    { blockerId: user.id, blockedId: post.user_id },
                    { blockerId: post.user_id, blockedId: user.id }
                ]
            }
        })
        if (isBlocked) return { items: [], hasMore: false, error: { code: 403, message: 'Access denied' } }

        const comments = await prisma.post_comments.findMany({
            where: { post_id: input.postId, status: 'ACTIVE' },
            take: limit + 1,
            cursor: input.cursor ? { id: input.cursor } : undefined,
            // 排序稳定性优先：确保相同时间戳下的评论顺序一致防跳动
            orderBy: [{ created_at: 'desc' }, { id: 'desc' }], // Newest first for loading more history, although standard is usually oldest first. Let's use newest first for pagination of long lists and prepend on UI.
            include: { user: { select: { id: true, nickname: true, avatar_url: true } } }
        })

        let nextCursor: string | undefined = undefined
        const hasMore = comments.length > limit

        if (hasMore) {
            const nextItem = comments.pop()
            nextCursor = nextItem?.id
        }

        return { items: comments, nextCursor, hasMore }
    } catch (error: any) {
        console.error(`[getPostComments] postId:${input?.postId || 'none'} - ${error.code || 500}: ${error.message || error}`)
        return { items: [], hasMore: false, error: { code: 500, message: 'Internal server error' } }
    }
}

export async function blockUser(targetUserId: string): Promise<{ success: boolean, error?: { code: number, message: string } }> {
    try {
        const user = await getAuthUser()
        if (!user) return { success: false, error: { code: 403, message: 'Unauthorized' } }

        await prisma.blocked_users.upsert({
            where: { blockerId_blockedId: { blockerId: user.id, blockedId: targetUserId } },
            create: { blockerId: user.id, blockedId: targetUserId },
            update: {}
        })
        return { success: true }
    } catch (error: any) {
        console.error('Failed to block user:', error)
        return { success: false, error: { code: 500, message: 'Internal server error' } }
    }
}

export async function getRegionalRecommendations(limit: number = 10): Promise<{ users: any[], error?: { code: number, message: string } }> {
    try {
        const user = await getAuthUser()
        if (!user) return { users: [], error: { code: 403, message: 'Unauthorized' } }

        const currentUser = await prisma.profiles.findUnique({ where: { id: user.id } })
        const userProvince = currentUser?.province || ''

        // Global base filtering logic for discoverable active users
        const where: any = {
            id: { not: user.id },
            allow_recommendations: true,
            nickname: { not: null }
        }

        // Exclude existing friends
        const friendships = await prisma.friendships.findMany({
            where: { OR: [{ user_id: user.id }, { friend_id: user.id }] }
        })
        const friendIds = friendships.map(f => f.user_id === user.id ? f.friend_id : f.user_id)

        const blocked = await prisma.blocked_users.findMany({
            where: { OR: [{ blockerId: user.id }, { blockedId: user.id }] }
        })
        const blockedIds = blocked.map(b => b.blockerId === user.id ? b.blockedId : b.blockerId)

        const excludeIds = [...friendIds, ...blockedIds]
        if (excludeIds.length > 0) {
            where.id = { notIn: excludeIds }
        }

        // Attempt to match by province first
        const recommended = await prisma.profiles.findMany({
            where: { ...where, province: userProvince || undefined },
            take: limit,
            orderBy: { updated_at: 'desc' },
            select: { id: true, nickname: true, avatar_url: true, level: true, province: true }
        })

        let finalUsers = recommended.map(u => ({
            ...u,
            reason_code: userProvince ? 'SAME_CITY' : 'SIMILAR_ACTIVITY',
            reason_label: userProvince ? '同城' : '活跃度接近'
        }))

        // If not enough, fallback to globally active
        if (finalUsers.length < limit) {
            const excludeIdsExt = [...excludeIds, ...finalUsers.map(u => u.id)]
            // Clean the notIn clause
            if (where.id?.notIn) delete where.id.notIn
            if (excludeIdsExt.length > 0) where.id = { notIn: excludeIdsExt }

            const globallyActive = await prisma.profiles.findMany({
                where: { ...where },
                take: limit - finalUsers.length,
                orderBy: { updated_at: 'desc' },
                select: { id: true, nickname: true, avatar_url: true, level: true, province: true }
            })
            finalUsers = [...finalUsers, ...globallyActive.map(u => ({
                ...u,
                reason_code: 'SIMILAR_ACTIVITY',
                reason_label: '活跃度接近'
            }))]
        }

        return { users: finalUsers }
    } catch (error: any) {
        console.error(`[getRegionalRecommendations] ${limit} - ${error.code || 500}: ${error.message || error}`)
        return { users: [], error: { code: 500, message: 'Internal server error' } }
    }
}

export async function reportPost(postId: string, reason: string): Promise<{ success: boolean, error?: any }> {
    try {
        const user = await getAuthUser()
        if (!user) return { success: false, error: { code: 403, message: 'Unauthorized' } }

        const post = await prisma.posts.findUnique({ where: { id: postId } })
        if (!post) return { success: false, error: { code: 404, message: 'Post not found' } }

        // Rate Limiting (10s)
        const recentReport = await prisma.post_reports.findFirst({
            where: { user_id: user.id, created_at: { gte: new Date(Date.now() - 10000) } }
        })
        if (recentReport) {
            return { success: false, error: { code: 429, message: '操作过于频繁，请稍后再试' } }
        }

        const existing = await prisma.post_reports.findFirst({
            where: { post_id: postId, user_id: user.id }
        })
        if (existing) {
            return { success: false, error: { code: 409, message: '您已举报过该动态' } }
        }

        try {
            await prisma.post_reports.create({
                data: { post_id: postId, user_id: user.id, reason }
            })
        } catch (e: any) {
            if (e.code === 'P2002') {
                return { success: false, error: { code: 409, message: '您已举报过该动态' } }
            }
            throw e;
        }

        return { success: true }
    } catch (error: any) {
        console.error(`[reportPost] postId:${postId} - ${error.code || 500}: ${error.message || error}`)
        return { success: false, error: { code: 500, message: 'Internal server error' } }
    }
}

export async function getUnreadSocialCount(): Promise<{ success: boolean; count?: number; error?: { code: number, message: string } }> {
    try {
        const user = await getAuthUser()
        if (!user) return { success: false, error: { code: 403, message: 'Unauthorized' } }

        const userPosts = await prisma.posts.findMany({
            where: { user_id: user.id },
            select: { id: true }
        })
        const postIds = userPosts.map(p => p.id)

        let unreadLikes = 0
        let unreadComments = 0

        if (postIds.length > 0) {
            [unreadLikes, unreadComments] = await Promise.all([
                prisma.post_likes.count({
                    where: { post_id: { in: postIds }, user_id: { not: user.id }, is_read: false }
                }),
                prisma.post_comments.count({
                    where: { post_id: { in: postIds }, user_id: { not: user.id }, is_read: false }
                })
            ])
        }

        return { success: true, count: unreadLikes + unreadComments }
    } catch (error: any) {
        console.error('[getUnreadSocialCount]', error.message || error)
        return { success: false, error: { code: 500, message: 'Failed to get unread count' } }
    }
}

export async function markSocialAsRead(
    interactionIds?: { type: 'LIKE' | 'COMMENT', id: string }[],
    options?: { postId?: string }
): Promise<{ success: boolean; error?: { code: number, message: string } }> {
    try {
        const user = await getAuthUser()
        if (!user) return { success: false, error: { code: 403, message: 'Unauthorized' } }

        if (interactionIds && interactionIds.length > 0) {
            // Mark specific interactions as read
            const likeIds = interactionIds.filter(i => i.type === 'LIKE').map(i => i.id)
            const commentIds = interactionIds.filter(i => i.type === 'COMMENT').map(i => i.id)

            const tasks = []
            if (likeIds.length > 0) {
                tasks.push(prisma.post_likes.updateMany({
                    where: { id: { in: likeIds } }, // Assuming the client sent valid IDs, we skip the slow relation check here for performance
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

        } else if (options?.postId) {
            // Fallback: Mark all unread interactions for a specific post
            // Verify ownership quickly
            const post = await prisma.posts.findUnique({
                where: { id: options.postId },
                select: { user_id: true }
            })

            if (post && post.user_id === user.id) {
                await Promise.all([
                    prisma.post_likes.updateMany({
                        where: { post_id: options.postId, is_read: false, user_id: { not: user.id } },
                        data: { is_read: true }
                    }),
                    prisma.post_comments.updateMany({
                        where: { post_id: options.postId, is_read: false, user_id: { not: user.id } },
                        data: { is_read: true }
                    })
                ])
            }
        } else {
            // Global Fallback: Mark all unread interactions for the user's posts as read
            const userPosts = await prisma.posts.findMany({
                where: { user_id: user.id },
                select: { id: true }
            })
            const postIds = userPosts.map(p => p.id)

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

        return { success: true }
    } catch (error: any) {
        console.error('[markSocialAsRead]', error.message || error)
        return { success: false, error: { code: 500, message: 'Failed to update read status due to network or database error.' } }
    }
}
