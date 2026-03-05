'use server'

import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// ── Admin Authorization (same pattern as backgrounds.ts) ─────
const ADMIN_EMAILS = ['xn_fly@qq.com', 'oliverhe202018@gmail.com']

async function requireAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) {
        throw new Error('Unauthorized: Admin access required')
    }
    return { user, supabase }
}

function getAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured')
    return createAdminClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    })
}

// ── Get all store items (admin) ──────────────────────────────────
export async function getAllStoreItems() {
    try {
        await requireAdmin()
        const items = await prisma.store_items.findMany({
            orderBy: { created_at: 'desc' },
            include: {
                _count: { select: { purchases: true } },
            },
        })
        return { success: true, items }
    } catch (e: any) {
        return { success: false, error: e.message || 'Failed to fetch' }
    }
}

// ── Upsert store item ────────────────────────────────────────────
export interface StoreItemInput {
    id?: string
    name: string
    description?: string
    image_url?: string
    price: number
    inventory_count: number
    purchase_limit_per_user: number
    is_active: boolean
}

export async function upsertStoreItem(input: StoreItemInput) {
    try {
        await requireAdmin()

        const data = {
            name: input.name,
            description: input.description || null,
            image_url: input.image_url || null,
            price: input.price,
            inventory_count: input.inventory_count,
            purchase_limit_per_user: input.purchase_limit_per_user,
            is_active: input.is_active,
        }

        if (input.id) {
            const item = await prisma.store_items.update({
                where: { id: input.id },
                data,
            })
            return { success: true, item }
        } else {
            const item = await prisma.store_items.create({ data })
            return { success: true, item }
        }
    } catch (e: any) {
        return { success: false, error: e.message || 'Failed to save' }
    }
}

// ── Delete store item ────────────────────────────────────────────
export async function deleteStoreItem(id: string) {
    try {
        await requireAdmin()

        // Check for existing purchases
        const purchaseCount = await prisma.user_purchases.count({
            where: { item_id: id, status: 'COMPLETED' },
        })

        if (purchaseCount > 0) {
            // Soft delete: mark inactive instead of hard delete
            await prisma.store_items.update({
                where: { id },
                data: { is_active: false },
            })
            return { success: true, softDeleted: true, purchaseCount }
        }

        await prisma.store_items.delete({ where: { id } })
        return { success: true, softDeleted: false }
    } catch (e: any) {
        return { success: false, error: e.message || 'Failed to delete' }
    }
}

// ── Upload store item image ──────────────────────────────────────
export async function uploadStoreItemImage(formData: FormData) {
    try {
        await requireAdmin()
        const adminClient = getAdminClient()

        const file = formData.get('file') as File
        if (!file) return { success: false, error: 'No file provided' }

        const maxSize = 2 * 1024 * 1024 // 2MB
        if (file.size > maxSize) return { success: false, error: 'File too large (max 2MB)' }

        const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
        const allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif']
        if (!allowed.includes(ext)) return { success: false, error: 'Invalid file type' }

        const filePath = `store-items/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`

        const { error: uploadError } = await adminClient.storage
            .from('backgrounds')
            .upload(filePath, file, { upsert: true })

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = adminClient.storage
            .from('backgrounds')
            .getPublicUrl(filePath)

        return { success: true, url: publicUrl }
    } catch (e: any) {
        return { success: false, error: e.message || 'Upload failed' }
    }
}
