'use server'
import { createClient } from '@/lib/supabase/server'

export interface UnreadVersion {
    id: string
    version: string
    title: string | null
    is_latest: boolean
    published_at: string
    item_previews: string[]  // 前 3 条内容，用于弹窗预览
}

export async function getUnreadVersions(): Promise<{
    data: UnreadVersion[] | null
    error: string | null
    userId: string | null
}> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { data: [], error: null, userId: null }

        const { prisma } = await import('@/lib/prisma')

        // 并行查询：所有已发布版本 + 该用户已读记录
        const [versions, reads] = await Promise.all([
            prisma.changelog_versions.findMany({
                where: { published_at: { not: null } },
                include: { items: { select: { content: true, sort_order: true } } },
                orderBy: { published_at: 'desc' }
            }),
            prisma.user_changelog_reads.findMany({
                where: { user_id: user.id },
                select: { version_id: true }
            })
        ])

        const readSet = new Set(reads.map((r) => r.version_id))
        const unread = versions
            .filter((v) => !readSet.has(v.id))
            .map((v) => {
                const previewItems = v.items
                    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                    .slice(0, 3)
                    .map((i) => i.content)
                return {
                    id:            v.id,
                    version:       v.version,
                    title:         v.title,
                    is_latest:     v.is_latest,
                    published_at:  v.published_at?.toISOString() ?? '',
                    item_previews: previewItems,
                }
            })

        return { data: unread as UnreadVersion[], error: null, userId: user.id }
    } catch (err: any) {
        return { data: null, error: err.message, userId: null }
    }
}

export async function getUnreadCount(): Promise<number> {
    const { data } = await getUnreadVersions()
    return data?.length ?? 0
}

export async function markVersionsAsRead(versionIds: string[]): Promise<void> {
    if (versionIds.length === 0) return
    try {
        const supabase = await createClient()
        const { prisma } = await import('@/lib/prisma')
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // 批量写入已读记录
        await prisma.user_changelog_reads.createMany({
            data: versionIds.map(version_id => ({
                user_id: user.id,
                version_id,
            })),
            skipDuplicates: true
        })
    } catch (err) {
        console.error('Mark versions as read error:', err)
        // 标记已读失败不影响用户体验，静默处理
    }
}

export async function markVersionAsRead(versionId: string): Promise<void> {
    await markVersionsAsRead([versionId])
}
