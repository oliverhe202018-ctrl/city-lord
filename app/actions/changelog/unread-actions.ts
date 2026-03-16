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

        // 并行查询：所有已发布版本 + 该用户已读记录
        const [versionsRes, readsRes] = await Promise.all([
            supabase
                .from('changelog_versions')
                .select('id, version, title, is_latest, published_at, changelog_items(content, sort_order, tag)')
                .not('published_at', 'is', null)
                .order('published_at', { ascending: false }),
            supabase
                .from('user_changelog_reads')
                .select('version_id')
                .eq('user_id', user.id),
        ])

        if (versionsRes.error) return { data: null, error: versionsRes.error.message, userId: user.id }

        const readSet = new Set((readsRes.data ?? []).map((r: any) => r.version_id))
        const unread = (versionsRes.data ?? [])
            .filter((v: any) => !readSet.has(v.id))
            .map((v: any) => {
                const items = (v.changelog_items ?? [])
                    .sort((a: any, b: any) => a.sort_order - b.sort_order)
                    .slice(0, 3)
                    .map((i: any) => i.content)
                return {
                    id:            v.id,
                    version:       v.version,
                    title:         v.title,
                    is_latest:     v.is_latest,
                    published_at:  v.published_at,
                    item_previews: items,
                }
            })

        return { data: unread, error: null, userId: user.id }
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
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const rows = versionIds.map(version_id => ({
            user_id: user.id,
            version_id,
        }))

        // upsert 避免唯一约束冲突
        await supabase
            .from('user_changelog_reads')
            .upsert(rows, { onConflict: 'user_id,version_id', ignoreDuplicates: true })
    } catch {
        // 标记已读失败不影响用户体验，静默处理
    }
}

export async function markVersionAsRead(versionId: string): Promise<void> {
    await markVersionsAsRead([versionId])
}
