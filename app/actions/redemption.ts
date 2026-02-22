'use server'

import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

// ==========================================
// STAGE 3A API CONTRACT: TRANSACTION REDEMPTION DRAFT
// Note: This file defines the explicit boundaries and safety rules
// for managing point redemptions.
// ==========================================

export interface RedeemItemInput {
    itemId: string
    idempotencyKey: string
    seasonId?: string
}

export interface RedeemResponse {
    success: boolean
    transactionId?: string
    error?: {
        code: number
        message: string
    }
}

async function getAuthUser() {
    const cookieStore = await cookies()
    const supabase = await createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    return user
}

/**
 * Safely processes a point redemption using Prisma $transaction.
 * @validation 404 Item not found
 * @validation 409 Idempotency conflict (key already exists)
 * @validation 422 Insufficient inventory or points
 */
export async function redeemItem(input: RedeemItemInput): Promise<RedeemResponse> {
    try {
        const user = await getAuthUser()
        if (!user) return { success: false, error: { code: 403, message: 'Unauthorized' } }

        const { itemId, idempotencyKey, seasonId } = input

        if (!idempotencyKey) {
            return { success: false, error: { code: 400, message: 'Idempotency key is required' } }
        }

        // Phase 1: Pre-Transaction Idempotency Check
        const existingPurchase = await prisma.user_purchases.findUnique({
            where: { idempotency_key: idempotencyKey }
        })

        if (existingPurchase) {
            if (existingPurchase.status === 'COMPLETED') {
                return { success: true, transactionId: existingPurchase.id }
            }
            return { success: false, error: { code: 409, message: 'Transaction already in progress or failed' } }
        }

        // Phase 2: Transaction Execution
        const transactionResult = await prisma.$transaction(async (tx) => {
            const item = await tx.store_items.findUnique({ where: { id: itemId } })
            if (!item) throw new Error('NOT_FOUND')
            if (!item.is_active) throw new Error('NOT_ACTIVE')

            // Inventory Check (-1 means unlimited)
            if (item.inventory_count !== -1 && item.inventory_count <= 0) {
                throw new Error('OUT_OF_STOCK')
            }

            // User Balance Check
            const profile = await tx.profiles.findUnique({ where: { id: user.id } })
            if (!profile) throw new Error('USER_NOT_FOUND')
            if ((profile.coins || 0) < item.price) {
                throw new Error('INSUFFICIENT_FUNDS')
            }

            // Check User Limit
            const userCurrentPurchasesCount = await tx.user_purchases.count({
                where: { user_id: user.id, item_id: itemId, status: 'COMPLETED' }
            })

            if (userCurrentPurchasesCount >= item.purchase_limit_per_user) {
                throw new Error('LIMIT_REACHED')
            }

            // 1. Lock and create PENDING purchase audit record
            const purchase = await tx.user_purchases.create({
                data: {
                    idempotency_key: idempotencyKey,
                    user_id: user.id,
                    item_id: itemId,
                    status: 'PENDING',
                    season_id: seasonId || null
                }
            })

            // 2. Decrement Inventory (if applicable)
            if (item.inventory_count !== -1) {
                await tx.store_items.update({
                    where: { id: itemId },
                    data: { inventory_count: { decrement: 1 } }
                })
            }

            // 3. Deduct User Points
            await tx.profiles.update({
                where: { id: user.id },
                data: { coins: { decrement: item.price } }
            })

            // 4. Finalize Purchase Record
            const finalized = await tx.user_purchases.update({
                where: { id: purchase.id },
                data: { status: 'COMPLETED' }
            })

            return finalized
        })

        return { success: true, transactionId: transactionResult.id }

    } catch (error: any) {
        console.error(JSON.stringify({ action: 'redeemItem', error: error.message || error }))

        // Handle specific transaction errors cleanly
        if (error.message === 'NOT_FOUND') return { success: false, error: { code: 404, message: 'Item not found' } }
        if (error.message === 'OUT_OF_STOCK') return { success: false, error: { code: 422, message: 'Item is out of stock' } }
        if (error.message === 'INSUFFICIENT_FUNDS') return { success: false, error: { code: 400, message: 'Insufficient coins' } }
        if (error.message === 'LIMIT_REACHED') return { success: false, error: { code: 422, message: 'Purchase limit reached' } }
        if (error.message === 'NOT_ACTIVE') return { success: false, error: { code: 400, message: 'Item is no longer active' } }

        // Fallback for unique constraint violations (e.g. idempotency key race-condition on insert inside tx)
        if (error.code === 'P2002') {
            return { success: false, error: { code: 409, message: 'Request conflict' } }
        }

        return { success: false, error: { code: 500, message: 'Internal server error' } }
    }
}

export async function getStoreItems() {
    try {
        const items = await prisma.store_items.findMany({
            where: { is_active: true },
            orderBy: { created_at: 'desc' }
        })
        return { success: true, items }
    } catch (e: any) {
        return { success: false, error: 'Failed to fetch store items' }
    }
}
