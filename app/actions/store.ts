'use server'

import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export interface BuyItemResponse {
    success: boolean
    transactionId?: string
    error?: string
}

async function getAuthUser() {
    const cookieStore = await cookies()
    const supabase = await createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    return user
}

/**
 * Securely purchase a store item using interactive transactions.
 * Prevents overselling and double-spending.
 */
export async function buyStoreItem(itemId: string): Promise<BuyItemResponse> {
    try {
        const user = await getAuthUser()
        if (!user) {
            return { success: false, error: "未登录" }
        }

        const userId = user.id

        // 1. Prisma Interactive Transaction
        const result = await prisma.$transaction(async (tx) => {
            // 1.1 检查库存
            // Note: In a high-concurrency environment, we use atomic update + negative block 
            // instead of just checking before update.
            const item = await tx.storeItem.findUnique({
                where: { id: itemId }
            })

            if (!item || (item.inventory_count !== -1 && item.inventory_count <= 0)) {
                throw new Error("商品已售罄或不存在")
            }

            // 1.2 检查钱包余额 (使用 UserWallet)
            const wallet = await tx.userWallet.findUnique({
                where: { user_id: userId }
            })

            if (!wallet || wallet.sweat_coins < item.price) {
                throw new Error("积分不足")
            }

            // 1.3 原子扣库存 (关键点)
            let updatedItem = item
            if (item.inventory_count !== -1) {
                updatedItem = await tx.storeItem.update({
                    where: { id: itemId },
                    data: { inventory_count: { decrement: 1 } },
                })

                // 🚨 终极防线：负数阻断回滚
                // 由于 Postgres 的原子性，如果更新后变成负数，说明刚好被抢空
                if (updatedItem.inventory_count < 0) {
                    throw new Error("手慢了，商品刚刚被抢空")
                }
            }

            // 1.4 原子扣款 (使用 UserWallet)
            await tx.userWallet.update({
                where: { user_id: userId },
                data: { sweat_coins: { decrement: item.price } },
            })

            // 1.5 写入资金流水 (使用 WalletTransaction - 审计必备)
            const transactionRecord = await tx.walletTransaction.create({
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

        return { 
            success: true, 
            transactionId: (result as any).transactionRecord.id 
        }

    } catch (error: any) {
        console.error("[Store Purchase Error]:", error.message)
        return { 
            success: false, 
            error: error instanceof Error ? error.message : "请求失败，请稍后重试" 
        }
    }
}
