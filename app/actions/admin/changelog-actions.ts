'use server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// 管理员鉴权复用 get-feedback.ts 的模式
async function verifyAdmin(): Promise<string> {
    const supabase = await createClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session?.user) throw new Error('Unauthorized')

    const adminRole = await prisma.app_admins.findUnique({
        where: { id: session.user.id },
        select: { role: true }
    })

    if (!adminRole) throw new Error('Forbidden')
    return session.user.id
}

// ─── 版本 CRUD ────────────────────────────────────────────────────────────────

export async function getAdminChangelogs() {
    try {
        await verifyAdmin()
        const data = await prisma.changelog_versions.findMany({
            select: {
                id: true,
                version: true,
                title: true,
                is_latest: true,
                release_date: true,
                published_at: true,
                _count: {
                    select: { items: true }
                }
            },
            orderBy: {
                release_date: 'desc'
            }
        })

        // 映射格式以保持兼容性
        const mappedData = data.map(v => ({
            ...v,
            changelog_items: [{ count: v._count.items }]
        }))

        return { data: mappedData, error: null }
    } catch (err: any) {
        return { data: null, error: err.message }
    }
}

export type AdminChangelog = NonNullable<Awaited<ReturnType<typeof getAdminChangelogs>>['data']>[0]

export async function createChangelogVersion(input: {
    version: string
    title?: string
    is_latest?: boolean
    release_date?: string
}) {
    try {
        await verifyAdmin()
        if (input.is_latest) {
            await prisma.changelog_versions.updateMany({
                where: { is_latest: true },
                data: { is_latest: false }
            })
        }
        await prisma.changelog_versions.create({
            data: {
                version:      input.version.trim(),
                title:        input.title?.trim() || null,
                is_latest:    input.is_latest ?? false,
                release_date: input.release_date ? new Date(input.release_date) : new Date(),
            }
        })
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
        await verifyAdmin()
        if (input.is_latest) {
            await prisma.changelog_versions.updateMany({
                where: { 
                    is_latest: true,
                    id: { not: id }
                },
                data: { is_latest: false }
            })
        }
        await prisma.changelog_versions.update({
            where: { id },
            data: {
                ...(input.version      && { version: input.version.trim() }),
                ...(input.title !== undefined && { title: input.title?.trim() || null }),
                ...(input.is_latest !== undefined && { is_latest: input.is_latest }),
                ...(input.release_date && { release_date: new Date(input.release_date) }),
            }
        })
        return { success: true, error: null }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function deleteChangelogVersion(id: string) {
    try {
        await verifyAdmin()
        await prisma.changelog_versions.delete({
            where: { id }
        })
        return { success: true, error: null }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── 条目 CRUD ────────────────────────────────────────────────────────────────

export async function getVersionWithItems(versionId: string) {
    try {
        await verifyAdmin()
        const data = await prisma.changelog_versions.findUnique({
            where: { id: versionId },
            include: {
                items: {
                    orderBy: {
                        sort_order: 'asc'
                    }
                }
            }
        })
        if (!data) return { data: null, error: 'Version not found' }
        // 映射格式以保持兼容性
        const mappedData = {
            ...data,
            changelog_items: data.items
        }
        return { data: mappedData, error: null }
    } catch (err: any) {
        return { data: null, error: err.message }
    }
}

export type ChangelogItem = NonNullable<NonNullable<Awaited<ReturnType<typeof getVersionWithItems>>['data']>['changelog_items']>[0]

export async function createChangelogItem(input: {
    version_id: string
    tag: string
    content: string
    sort_order?: number
}) {
    try {
        await verifyAdmin()
        await prisma.changelog_items.create({
            data: {
                version_id: input.version_id,
                tag:        input.tag,
                content:    input.content.trim(),
                sort_order: input.sort_order ?? 0,
            }
        })
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
        await verifyAdmin()
        await prisma.changelog_items.update({
            where: { id },
            data: input
        })
        return { success: true, error: null }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function deleteChangelogItem(id: string) {
    try {
        await verifyAdmin()
        await prisma.changelog_items.delete({
            where: { id }
        })
        return { success: true, error: null }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function publishVersion(id: string) {
    try {
        await verifyAdmin()
        const data = await prisma.changelog_versions.update({
            where: { id },
            data: { published_at: new Date() },
            select: { version: true }
        })
        return { success: true, error: null, version: data.version }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function batchUpdateSortOrders(
    updates: { id: string; sort_order: number }[]
) {
    try {
        await verifyAdmin()
        await Promise.all(
            updates.map(({ id, sort_order }) =>
                prisma.changelog_items.update({
                    where: { id },
                    data: { sort_order }
                })
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
        await verifyAdmin()
        const data = await prisma.changelog_items.create({
            data: {
                version_id: input.version_id,
                tag:        input.tag,
                content:    input.content.trim(),
                sort_order: input.sort_order ?? 0,
            }
        })
        return { data, error: null }
    } catch (err: any) {
        return { data: null, error: err.message }
    }
}
