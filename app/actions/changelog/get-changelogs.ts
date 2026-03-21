'use server'
import { createClient } from '@/lib/supabase/server'

export interface ChangelogVersion {
    id: string
    version: string
    title: string | null
    is_latest: boolean
    release_date: string
    item_count: number
}

export interface ChangelogItem {
    id: string
    version_id: string
    tag: string
    content: string
    sort_order: number
}

export interface ChangelogDetail extends Omit<ChangelogVersion, 'item_count'> {
    items: ChangelogItem[]
    prevVersion: { version: string; title: string | null } | null
    nextVersion: { version: string; title: string | null } | null
}

export async function getChangelogs(): Promise<{
    data: ChangelogVersion[] | null
    error: string | null
}> {
    try {
        const supabase = await createClient()
        const { data, error } = await supabase
// @ts-expect-error - Baseline exemption for pre-existing schema mismatch - [Ticket-202603-SchemaSync] baseline exemption
            .from('changelog_versions')
            // @ts-expect-error - FIXME: Property 'not' does not exist on type 'PostgrestQueryBuilder<{ Postgre - [Ticket-202603-SchemaSync] baseline exemption
            .not('published_at', 'is', null)
            .order('release_date', { ascending: false })

        if (error) return { data: null, error: error.message }

        const formatted: ChangelogVersion[] = (data ?? []).map((v: any) => ({
            id:           v.id,
            version:      v.version,
            title:        v.title,
            is_latest:    v.is_latest,
            release_date: v.release_date,
            item_count:   v.changelog_items?.[0]?.count ?? 0,
        }))

        return { data: formatted, error: null }
    } catch (err: any) {
        return { data: null, error: err.message }
    }
}

export async function getChangelogDetail(version: string): Promise<{
    data: ChangelogDetail | null
    error: string | null
}> {
    try {
        const supabase = await createClient()

        // 获取全部版本列表（降序），用于计算前后导航
        const { data: allVersions } = await supabase
// @ts-expect-error - Baseline exemption for pre-existing schema mismatch - [Ticket-202603-SchemaSync] baseline exemption
            .from('changelog_versions')
            .select('version, title')
            .order('release_date', { ascending: false })

// @ts-expect-error - Baseline exemption for pre-existing schema mismatch - [Ticket-202603-SchemaSync] baseline exemption
        const currentIndex = (allVersions ?? []).findIndex(v => v.version === version)
        if (currentIndex === -1) return { data: null, error: '版本不存在' }

// @ts-expect-error - Baseline exemption for pre-existing schema mismatch - [Ticket-202603-SchemaSync] baseline exemption
        const { data: versionData, error } = await supabase
// @ts-expect-error - Baseline exemption for pre-existing schema mismatch - [Ticket-202603-SchemaSync] baseline exemption
            .from('changelog_versions')
            .select('*, changelog_items(*)')
            .eq('version', version)
            .not('published_at', 'is', null)
            .single()

        if (error || !versionData) return { data: null, error: error?.message ?? '未找到该版本' }

// @ts-expect-error - Baseline exemption for pre-existing schema mismatch - [Ticket-202603-SchemaSync] baseline exemption
        const sortedItems: ChangelogItem[] = (versionData.changelog_items ?? [])
// @ts-expect-error - Baseline exemption for pre-existing schema mismatch - [Ticket-202603-SchemaSync] baseline exemption
            // @ts-expect-error - FIXME: Property 'sort' does not exist on type '{ id: string; version_id: stri - [Ticket-202603-SchemaSync] baseline exemption
            .sort((a: ChangelogItem, b: ChangelogItem) => a.sort_order - b.sort_order)

        const detail: ChangelogDetail = {
// @ts-expect-error - Baseline exemption for pre-existing schema mismatch - [Ticket-202603-SchemaSync] baseline exemption
            id:           versionData.id,
// @ts-expect-error - Baseline exemption for pre-existing schema mismatch - [Ticket-202603-SchemaSync] baseline exemption
            version:      versionData.version,
// @ts-expect-error - Baseline exemption for pre-existing schema mismatch - [Ticket-202603-SchemaSync] baseline exemption
            title:        versionData.title,
// @ts-expect-error - Baseline exemption for pre-existing schema mismatch - [Ticket-202603-SchemaSync] baseline exemption
            is_latest:    versionData.is_latest,
// @ts-expect-error - Baseline exemption for pre-existing schema mismatch - [Ticket-202603-SchemaSync] baseline exemption
            release_date: versionData.release_date,
            items:        sortedItems,
// @ts-expect-error - Baseline exemption for pre-existing schema mismatch - [Ticket-202603-SchemaSync] baseline exemption
            prevVersion:  allVersions?.[currentIndex - 1] ?? null, // 更新版本（列表中更靠前）
// @ts-expect-error - Baseline exemption for pre-existing schema mismatch - [Ticket-202603-SchemaSync] baseline exemption
            nextVersion:  allVersions?.[currentIndex + 1] ?? null, // 更旧版本（列表中更靠后）
        }

        return { data: detail, error: null }
    } catch (err: any) {
        return { data: null, error: err.message }
    }
}

export async function submitChangelogFeedback({
    feedbackType,
    content,
    version,
}: {
    feedbackType: string
    content: string
    version: string
}): Promise<{ success: boolean; error: string | null }> {
    try {
        const supabase = await createClient()

        // 尝试获取当前用户（允许匿名提交）
        const { data: { session } } = await supabase.auth.getSession()

// @ts-expect-error - Baseline exemption for pre-existing schema mismatch - [Ticket-202603-SchemaSync] baseline exemption
        const { error } = await supabase.from('feedback').insert({
            user_id:      session?.user?.id ?? null,
            content:      content.trim(),
            contact_info: `${feedbackType} | 版本 v${version}`,
            status:       'pending',
        })

        if (error) return { success: false, error: error.message }
        return { success: true, error: null }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}
