'use server'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

// 管理员鉴权复用 get-feedback.ts 的模式
async function verifyAdmin(): Promise<SupabaseClient> {
    const supabase = await createClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session?.user) throw new Error('Unauthorized')

    const { data: adminRole } = await supabase
        .from('app_admins')
        .select('role')
        .eq('user_id', session.user.id)
        .single()

    if (!adminRole) throw new Error('Forbidden')
    return supabase
}

// ─── 版本 CRUD ────────────────────────────────────────────────────────────────

export async function getAdminChangelogs() {
    try {
        const supabase = await verifyAdmin()
        const { data, error } = await supabase
            .from('changelog_versions')
            .select('id, version, title, is_latest, release_date, published_at, changelog_items(count)')
            .order('release_date', { ascending: false })

        if (error) return { data: null, error: error.message }
        return { data, error: null }
    } catch (err: any) {
        return { data: null, error: err.message }
    }
}

export async function createChangelogVersion(input: {
    version: string
    title?: string
    is_latest?: boolean
    release_date?: string
}) {
    try {
        const supabase = await verifyAdmin()
        if (input.is_latest) {
            await supabase
                .from('changelog_versions')
                .update({ is_latest: false })
                .eq('is_latest', true)
        }
        const { error } = await supabase.from('changelog_versions').insert({
            version:      input.version.trim(),
            title:        input.title?.trim() || null,
            is_latest:    input.is_latest ?? false,
            release_date: input.release_date ?? new Date().toISOString(),
        })
        if (error) return { success: false, error: error.message }
        return { success: true, error: null }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function updateChangelogVersion(
    id: string,
    input: { version?: string; title?: string; is_latest?: boolean; release_date?: string }
) {
    try {
        const supabase = await verifyAdmin()
        if (input.is_latest) {
            await supabase
                .from('changelog_versions')
                .update({ is_latest: false })
                .eq('is_latest', true)
                .neq('id', id)
        }
        const { error } = await supabase
            .from('changelog_versions')
            .update({
                ...(input.version      && { version: input.version.trim() }),
                ...(input.title !== undefined && { title: input.title?.trim() || null }),
                ...(input.is_latest !== undefined && { is_latest: input.is_latest }),
                ...(input.release_date && { release_date: input.release_date }),
            })
            .eq('id', id)
        if (error) return { success: false, error: error.message }
        return { success: true, error: null }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function deleteChangelogVersion(id: string) {
    try {
        const supabase = await verifyAdmin()
        const { error } = await supabase
            .from('changelog_versions')
            .delete()
            .eq('id', id)
        if (error) return { success: false, error: error.message }
        return { success: true, error: null }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── 条目 CRUD ────────────────────────────────────────────────────────────────

export async function getVersionWithItems(versionId: string) {
    try {
        const supabase = await verifyAdmin()
        const { data, error } = await supabase
            .from('changelog_versions')
            .select('*, changelog_items(*)')
            .eq('id', versionId)
            .single()
        if (error) return { data: null, error: error.message }
        const sorted = {
            ...data,
            changelog_items: (data.changelog_items ?? []).sort(
                (a: any, b: any) => a.sort_order - b.sort_order
            ),
        }
        return { data: sorted, error: null }
    } catch (err: any) {
        return { data: null, error: err.message }
    }
}

export async function createChangelogItem(input: {
    version_id: string
    tag: string
    content: string
    sort_order?: number
}) {
    try {
        const supabase = await verifyAdmin()
        const { error } = await supabase.from('changelog_items').insert({
            version_id: input.version_id,
            tag:        input.tag,
            content:    input.content.trim(),
            sort_order: input.sort_order ?? 0,
        })
        if (error) return { success: false, error: error.message }
        return { success: true, error: null }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function updateChangelogItem(
    id: string,
    input: { tag?: string; content?: string; sort_order?: number }
) {
    try {
        const supabase = await verifyAdmin()
        const { error } = await supabase
            .from('changelog_items')
            .update(input)
            .eq('id', id)
        if (error) return { success: false, error: error.message }
        return { success: true, error: null }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function deleteChangelogItem(id: string) {
    try {
        const supabase = await verifyAdmin()
        const { error } = await supabase
            .from('changelog_items')
            .delete()
            .eq('id', id)
        if (error) return { success: false, error: error.message }
        return { success: true, error: null }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}
// 追加到文件末尾
export async function publishVersion(id: string) {
    try {
        const supabase = await verifyAdmin()
        const { data, error } = await supabase
            .from('changelog_versions')
            .update({ published_at: new Date().toISOString() })
            .eq('id', id)
            .select('version, title')
            .single()

        if (error) return { success: false, error: error.message }
        return { success: true, error: null, version: data.version }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// 拖拽排序后批量更新 sort_order
export async function batchUpdateSortOrders(
    updates: { id: string; sort_order: number }[]
) {
    try {
        const supabase = await verifyAdmin()
        await Promise.all(
            updates.map(({ id, sort_order }) =>
                supabase.from('changelog_items').update({ sort_order }).eq('id', id)
            )
        )
        return { success: true, error: null }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// 创建条目并返回完整行数据（供可视化编辑器乐观更新）
export async function createChangelogItemWithReturn(input: {
    version_id: string
    tag: string
    content: string
    sort_order?: number
}) {
    try {
        const supabase = await verifyAdmin()
        const { data, error } = await supabase
            .from('changelog_items')
            .insert({
                version_id: input.version_id,
                tag:        input.tag,
                content:    input.content.trim(),
                sort_order: input.sort_order ?? 0,
            })
            .select()
            .single()
        if (error || !data) return { data: null, error: error?.message ?? 'Insert failed' }
        return { data, error: null }
    } catch (err: any) {
        return { data: null, error: err.message }
    }
}
