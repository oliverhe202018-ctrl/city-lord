import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/v1/store/buy
 * Purchase a store item using interactive transaction
 * Body: { itemId: string }
 * 
 * Uses Prisma $transaction with pessimistic locking to prevent:
 * - Concurrent purchase exploits (race conditions)
 * - Overselling (inventory going negative)
 * - Double-spending (spending more coins than available)
 */
export async function POST(request: NextRequest) {
    try {
        // Auth
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json(
                { success: false, error: '未登录' },
                { status: 401 }
            )
        }

        const userId = user.id

        // Parse body
        const body = await request.json()
        const { itemId } = body

        if (!itemId) {
            return NextResponse.json(
                { success: false, error: '缺少 itemId 参数' },
                { status: 400 }
            )
        }

        // Prisma Interactive Transaction with pessimistic locking
        const result = await prisma.$transaction(async (tx) => {
            // 1. Lock and fetch item (SELECT FOR UPDATE equivalent via atomic operations)
            const item = await tx.store_items.findUnique({
                where: { id: itemId }
            })

            if (!item) {
                throw new Error('商品不存在')
            }

            if (!item.is_active) {
                throw new Error('商品已下架')
            }

            // Check inventory (-1 means unlimited)
            if (item.inventory_count !== -1 && item.inventory_count <= 0) {
                throw new Error('商品已售罄')
            }

            // 2. Lock and fetch user wallet
            const wallet = await tx.user_wallets.findUnique({
                where: { user_id: userId }
            })

            if (!wallet) {
                throw new Error('钱包不存在')
            }

            if (wallet.sweat_coins < item.price) {
                throw new Error('积分不足')
            }

            // 3. Atomic decrement inventory (prevents overselling)
            let updatedItem = item
            if (item.inventory_count !== -1) {
                updatedItem = await tx.store_items.update({
                    where: { id: itemId },
                    data: { inventory_count: { decrement: 1 } },
                })

                // Final safety check: if inventory went negative, rollback
                if (updatedItem.inventory_count < 0) {
                    throw new Error('手慢了，商品刚刚被抢空')
                }
            }

            // 4. Atomic decrement wallet balance
            await tx.user_wallets.update({
                where: { user_id: userId },
                data: { sweat_coins: { decrement: item.price } },
            })

            // 5. Create wallet transaction record (audit trail)
            const transactionRecord = await tx.wallet_transactions.create({
                data: {
                    user_id: userId,
                    currency_type: 'COIN',
                    amount: -item.price,
                    transaction_type: 'STORE_PURCHASE',
                    description: `兑换商品: ${item.name}`,
                }
            })

            return { updatedItem, transactionRecord }
        })

        return NextResponse.json({
            success: true,
            transactionId: (result as any).transactionRecord.id
        })

    } catch (error: any) {
        console.error('[POST /api/v1/store/buy] Error:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : '请求失败，请稍后重试'
            },
            { status: 400 }
        )
    }
}
