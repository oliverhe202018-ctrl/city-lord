'use server'

import { prisma } from '@/lib/prisma'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAdminSession } from '@/lib/admin/auth'

// ─── Admin Authorization ───────────────────────────────────
async function checkAdminAuth() {
    await requireAdminSession()
    return true
}

// ─── Supabase Admin Client (Service Role) ─────────────────
function getAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!serviceRoleKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured')
    }

    return createAdminClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
}

// ─── Types ─────────────────────────────────────────────────
export interface BackgroundRecord {
    id: string
    name: string
    image_url: string
    preview_url: string | null
    is_default: boolean
    condition_type: string | null
    condition_value: number | null
    price_coins: number | null
    created_at: Date
    usageCount: number
}

export interface BackgroundFormData {
    id?: string // for edit mode
    name: string
    image_url: string
    preview_url?: string
    acquisitionType: 'free' | 'coins' | 'level'
    price_coins?: number
    condition_value?: number
}

// ─── Upload Image ──────────────────────────────────────────
export async function uploadBackgroundImage(formData: FormData) {
    await checkAdminAuth()

    const file = formData.get('file') as File | null
    if (!file) {
        return { success: false, error: '未选择文件' }
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
        return { success: false, error: '仅支持 JPG/PNG/WebP 格式' }
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
        return { success: false, error: '文件大小不能超过 5MB' }
    }

    try {
        const adminClient = getAdminClient()

        // Generate unique filename
        const timestamp = Date.now()
        const randomStr = Math.random().toString(36).substring(2, 8)
        const ext = file.name.split('.').pop()
        const filename = `bg_${timestamp}_${randomStr}.${ext}`

        // Upload to Supabase Storage using service role
        const { data, error } = await adminClient.storage
            .from('background-assets')
            .upload(filename, file, {
                contentType: file.type,
                cacheControl: '3600',
                upsert: false,
            })

        if (error) {
            console.error('Upload error:', error)
            return { success: false, error: `上传失败: ${error.message}` }
        }

        // Get public URL
        const { data: { publicUrl } } = adminClient.storage
            .from('background-assets')
            .getPublicUrl(data.path)

        return { success: true, url: publicUrl }
    } catch (e: any) {
        console.error('Upload exception:', e)
        return { success: false, error: e.message }
    }
}

// ─── Get All Backgrounds ───────────────────────────────────
export async function getAllBackgrounds(): Promise<BackgroundRecord[]> {
    await checkAdminAuth()

    try {
        const backgrounds = await prisma.backgrounds.findMany({
            orderBy: { created_at: 'desc' },
        })

        // Get usage count for each background
        const backgroundsWithUsage = await Promise.all(
            backgrounds.map(async (bg) => {
                const usageCount = await prisma.user_backgrounds.count({
                    where: { background_id: bg.id },
                })

                return {
                    id: bg.id,
                    name: bg.name,
                    image_url: bg.image_url,
                    preview_url: bg.preview_url,
                    is_default: bg.is_default,
                    condition_type: bg.condition_type,
                    condition_value: bg.condition_value,
                    price_coins: bg.price_coins,
                    created_at: bg.created_at,
                    usageCount,
                }
            })
        )

        return backgroundsWithUsage
    } catch (e: any) {
        console.error('getAllBackgrounds error:', e)
        throw new Error('获取背景列表失败')
    }
}

// ─── Upsert Background ─────────────────────────────────────
export async function upsertBackground(formData: BackgroundFormData) {
    await checkAdminAuth()

    try {
        // Map form data to DB schema
        const data = {
            name: formData.name,
            image_url: formData.image_url,
            preview_url: formData.preview_url || formData.image_url, // fallback to image_url
            is_default: formData.acquisitionType === 'free',
            condition_type: formData.acquisitionType === 'level' ? 'level' : (formData.acquisitionType === 'coins' ? 'coins' : 'free'),
            condition_value: formData.acquisitionType === 'level' ? formData.condition_value : null,
            price_coins: formData.acquisitionType === 'coins' ? formData.price_coins : 0,
        }

        if (formData.id) {
            // Update existing
            await prisma.backgrounds.update({
                where: { id: formData.id },
                data,
            })
            return { success: true, message: '背景已更新' }
        } else {
            // Create new
            await prisma.backgrounds.create({ data })
            return { success: true, message: '背景已创建' }
        }
    } catch (e: any) {
        console.error('upsertBackground error:', e)
        return { success: false, error: e.message }
    }
}

// ─── Check Background Usage ────────────────────────────────
export async function checkBackgroundUsage(id: string) {
    await checkAdminAuth()

    try {
        const count = await prisma.user_backgrounds.count({
            where: { background_id: id },
        })
        return { inUse: count > 0, usageCount: count }
    } catch (e: any) {
        console.error('checkBackgroundUsage error:', e)
        throw new Error('检查失败')
    }
}

// ─── Delete Background ─────────────────────────────────────
export async function deleteBackground(id: string) {
    await checkAdminAuth()

    try {
        // Check if background is in use
        const usage = await checkBackgroundUsage(id)

        if (usage.inUse) {
            return {
                success: false,
                error: `该背景正被 ${usage.usageCount} 位用户使用，无法删除`,
            }
        }

        // Get background to extract filename for Storage deletion
        const bg = await prisma.backgrounds.findUnique({ where: { id } })

        if (!bg) {
            return { success: false, error: '背景不存在' }
        }

        // Delete from database first
        await prisma.backgrounds.delete({ where: { id } })

        // Try to delete from Storage (best effort, don't fail if it errors)
        try {
            const adminClient = getAdminClient()
            const urlParts = bg.image_url.split('/')
            const filename = urlParts[urlParts.length - 1]

            await adminClient.storage
                .from('background-assets')
                .remove([filename])
        } catch (storageError) {
            console.warn('Storage deletion failed (non-critical):', storageError)
        }

        return { success: true, message: '背景已删除' }
    } catch (e: any) {
        console.error('deleteBackground error:', e)
        return { success: false, error: e.message }
    }
}
