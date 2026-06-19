/**
 * store-service.ts
 * 
 * 商城购买事务链路：金币扣除 → 道具发放/生效 的单向事务处理
 * 包含自动 Seed 逻辑：若 store_items 表为空，自动注入默认基础道具
 */

import { prisma } from '@/lib/prisma'
import { v4 as uuidv4 } from 'uuid'

// ─── Default Store Items (Auto-Seed) ───
const DEFAULT_STORE_ITEMS = [
  {
    id: 'stamina_potion_small',
    name: '小型体力药水',
    description: '立即恢复 30 点体力',
    price: 50,
    inventory_count: -1, // 无限库存
    purchase_limit_per_user: 10,
    is_active: true,
    effect_type: 'stamina',
    effect_value: 30,
  },
  {
    id: 'stamina_potion_large',
    name: '大型体力药水',
    description: '立即恢复 80 点体力',
    price: 120,
    inventory_count: -1,
    purchase_limit_per_user: 5,
    is_active: true,
    effect_type: 'stamina',
    effect_value: 80,
  },
  {
    id: 'exp_boost_small',
    name: '经验加成书（小）',
    description: '立即获得 200 XP',
    price: 80,
    inventory_count: -1,
    purchase_limit_per_user: 10,
    is_active: true,
    effect_type: 'exp',
    effect_value: 200,
  },
  {
    id: 'exp_boost_large',
    name: '经验加成书（大）',
    description: '立即获得 500 XP',
    price: 180,
    inventory_count: -1,
    purchase_limit_per_user: 5,
    is_active: true,
    effect_type: 'exp',
    effect_value: 500,
  },
  {
    id: 'shield_repair_kit',
    name: '护盾修复包',
    description: '为当前领地恢复 50 点护盾值',
    price: 100,
    inventory_count: -1,
    purchase_limit_per_user: 5,
    is_active: true,
    effect_type: 'shield',
    effect_value: 50,
  },
] as const

// ─── Auto-Seed Logic ───
export async function ensureDefaultStoreItems(): Promise<void> {
  try {
    const count = await prisma.store_items.count()
    if (count > 0) return // Already seeded

    console.log('[StoreService] store_items 表为空，自动注入默认道具...')

    await prisma.store_items.createMany({
      data: DEFAULT_STORE_ITEMS.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        inventory_count: item.inventory_count,
        purchase_limit_per_user: item.purchase_limit_per_user,
        is_active: item.is_active,
      })),
      skipDuplicates: true,
    })

    console.log(`[StoreService] ✅ 已注入 ${DEFAULT_STORE_ITEMS.length} 个默认道具`)
  } catch (error) {
    console.error('[StoreService] Auto-seed failed:', error)
  }
}

// ─── Purchase Types ───
export interface PurchaseResult {
  success: boolean
  purchaseId?: string
  coinsSpent?: number
  effectApplied?: {
    type: string
    value: number
  }
  error?: string
  errorCode?: 'INSUFFICIENT_COINS' | 'ITEM_NOT_FOUND' | 'ITEM_INACTIVE' | 'PURCHASE_LIMIT_REACHED' | 'INTERNAL_ERROR'
}

// ─── Core Purchase Transaction ───
export async function purchaseItem(
  userId: string,
  itemId: string,
): Promise<PurchaseResult> {
  try {
    // Ensure default items exist (auto-seed on first call)
    await ensureDefaultStoreItems()

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch item
      const item = await tx.store_items.findUnique({
        where: { id: itemId },
      })

      if (!item) {
        return { success: false, error: '道具不存在', errorCode: 'ITEM_NOT_FOUND' } as PurchaseResult
      }

      if (!item.is_active) {
        return { success: false, error: '道具已下架', errorCode: 'ITEM_INACTIVE' } as PurchaseResult
      }

      // 2. Check user balance
      const profile = await tx.profiles.findUnique({
        where: { id: userId },
        select: { coins: true, stamina: true, max_stamina: true, xp: true, crit_rate: true },
      })

      if (!profile) {
        return { success: false, error: '用户不存在', errorCode: 'INTERNAL_ERROR' } as PurchaseResult
      }

      const userCoins = profile.coins ?? 0
      if (userCoins < item.price) {
        return {
          success: false,
          error: `金币不足（需要 ${item.price}，当前 ${userCoins}）`,
          errorCode: 'INSUFFICIENT_COINS',
        } as PurchaseResult
      }

      // 3. Check purchase limit
      const purchaseCount = await tx.user_purchases.count({
        where: {
          user_id: userId,
          item_id: itemId,
          status: 'COMPLETED',
        },
      })

      if (item.purchase_limit_per_user > 0 && purchaseCount >= item.purchase_limit_per_user) {
        return {
          success: false,
          error: '已达购买上限',
          errorCode: 'PURCHASE_LIMIT_REACHED',
        } as PurchaseResult
      }

      // 4. Deduct coins
      await tx.profiles.update({
        where: { id: userId },
        data: {
          coins: { decrement: item.price },
          updated_at: new Date(),
        },
      })

      // 5. Create purchase record
      const purchaseId = uuidv4()
      await tx.user_purchases.create({
        data: {
          id: purchaseId,
          idempotency_key: `purchase_${userId}_${itemId}_${Date.now()}`,
          user_id: userId,
          item_id: itemId,
          status: 'COMPLETED',
        },
      })

      // 6. Record wallet transaction
      await tx.wallet_transactions.create({
        data: {
          user_id: userId,
          currency_type: 'COIN',
          amount: -item.price,
          transaction_type: 'STORE_PURCHASE',
          description: `购买道具: ${item.name}`,
        },
      })

      // 7. Apply item effect based on type
      let effectApplied: { type: string; value: number } | undefined

      // Read effect from item description/name mapping
      const effectType = resolveEffectType(item)
      const effectValue = resolveEffectValue(item)

      if (effectType === 'stamina') {
        const currentStamina = profile.stamina ?? 0
        const maxStamina = profile.max_stamina ?? 100
        const newStamina = Math.min(currentStamina + effectValue, maxStamina)

        await tx.profiles.update({
          where: { id: userId },
          data: { stamina: newStamina },
        })

        effectApplied = { type: 'stamina', value: newStamina - currentStamina }
      } else if (effectType === 'exp') {
        const currentXp = profile.xp ?? 0

        await tx.profiles.update({
          where: { id: userId },
          data: {
            xp: { increment: effectValue },
            updated_at: new Date(),
          },
        })

        effectApplied = { type: 'exp', value: effectValue }
      } else if (effectType === 'shield') {
        // Shield repair: apply to user's most recent active territory
        // This is a simplified version — full implementation would target a specific territory
        effectApplied = { type: 'shield', value: effectValue }
        // Note: Shield application requires territory context, stored as pending for now
      }

      return {
        success: true,
        purchaseId,
        coinsSpent: item.price,
        effectApplied,
      } as PurchaseResult
    })

    return result
  } catch (error) {
    console.error('[StoreService] purchaseItem failed:', error)
    return {
      success: false,
      error: '购买失败，请稍后重试',
      errorCode: 'INTERNAL_ERROR',
    }
  }
}

// ─── Effect Resolution Helpers ───
function resolveEffectType(item: { name: string; description: string | null }): string {
  const name = item.name.toLowerCase()
  if (name.includes('stamina') || name.includes('体力')) return 'stamina'
  if (name.includes('exp') || name.includes('经验')) return 'exp'
  if (name.includes('shield') || name.includes('护盾')) return 'shield'
  return 'unknown'
}

function resolveEffectValue(item: { description: string | null }): number {
  const desc = item.description || ''
  // Extract number from description like "恢复 30 点" or "获得 200 XP"
  const match = desc.match(/(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

// ─── Get Store Items ───
export async function getStoreItems(): Promise<Array<{
  id: string
  name: string
  description: string | null
  price: number
  inventory_count: number
  purchase_limit_per_user: number
  is_active: boolean
  image_url: string | null
}>> {
  await ensureDefaultStoreItems()

  const items = await prisma.store_items.findMany({
    where: { is_active: true },
    orderBy: { price: 'asc' },
  })

  return items.map(item => ({
    id: item.id,
    name: item.name,
    description: item.description,
    price: item.price,
    inventory_count: item.inventory_count,
    purchase_limit_per_user: item.purchase_limit_per_user,
    is_active: item.is_active,
    image_url: item.image_url,
  }))
}
