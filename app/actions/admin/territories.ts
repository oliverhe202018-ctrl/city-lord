import { prisma } from '@/lib/prisma'
import { MAX_TERRITORY_HP, MAX_TERRITORY_SHIELD } from '@/lib/constants/territory'
import { revalidatePath } from 'next/cache'

export interface AdminTerritory {
  id: string
  city_id: string
  owner_id: string | null
  health: number
  current_hp: number | null // 护盾值
  status: string
  created_at: string
  area_m2: number | null
  neutral_until: string | null
  owner?: {
    id: string
    nickname: string | null
    avatar_url: string | null
  } | null
  city?: {
    id: string
    name: string
  } | null
}

export interface AdminTerritoryFilters {
  cityId?: string
  ownerId?: string
  status?: string
  minHp?: number
  maxHp?: number
}

export interface AdminTerritoryListResponse {
  success: boolean
  data?: AdminTerritory[]
  total?: number
  page?: number
  pageSize?: number
  error?: string
}

export async function getAdminTerritories(
  filters?: AdminTerritoryFilters,
  page: number = 1,
  pageSize: number = 20
): Promise<AdminTerritoryListResponse> {
  try {
    const where: any = {}
    
    if (filters?.cityId) where.city_id = filters.cityId
    if (filters?.ownerId) where.owner_id = filters.ownerId
    if (filters?.status) where.status = filters.status
    if (filters?.minHp !== undefined) where.health = { gte: filters.minHp }
    if (filters?.maxHp !== undefined) {
      where.health = { ...where.health, lte: filters.maxHp }
    }

    const [territories, total] = await Promise.all([
      prisma.territories.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              nickname: true,
              avatar_url: true,
            },
          },
          city: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      prisma.territories.count({ where }),
    ])

    return {
      success: true,
      data: territories as unknown as AdminTerritory[],
      total,
      page,
      pageSize,
    }
  } catch (err: any) {
    console.error('[getAdminTerritories] Error:', err)
    return {
      success: false,
      error: err?.message || '获取领地列表失败',
    }
  }
}

export interface ResetTerritoryHpResponse {
  success: boolean
  error?: string
}

export async function resetTerritoryHp(
  territoryId: string,
  resetShield: boolean = true
): Promise<ResetTerritoryHpResponse> {
  try {
    await prisma.$transaction(async (tx) => {
      const updateData: any = {
        health: MAX_TERRITORY_HP,
      }
      
      if (resetShield) {
        updateData.current_hp = MAX_TERRITORY_SHIELD
      }

      await tx.territories.update({
        where: { id: territoryId },
        data: updateData,
      })

      await tx.admin_logs.create({
        data: {
          action: 'reset_territory_hp',
          details: JSON.stringify({
            territoryId,
            resetHp: true,
            resetShield,
          }),
        },
      })
    })

    revalidatePath('/admin/territories')
    return { success: true }
  } catch (err: any) {
    console.error('[resetTerritoryHp] Error:', err)
    return {
      success: false,
      error: err?.message || '重置领地HP失败',
    }
  }
}

export interface TransferTerritoryResponse {
  success: boolean
  error?: string
}

export async function transferTerritory(
  territoryId: string,
  newOwnerId: string
): Promise<TransferTerritoryResponse> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.territories.update({
        where: { id: territoryId },
        data: {
          owner_id: newOwnerId,
          health: MAX_TERRITORY_HP,
          current_hp: MAX_TERRITORY_SHIELD,
          neutral_until: null,
        },
      })

      await tx.admin_logs.create({
        data: {
          action: 'transfer_territory',
          details: JSON.stringify({
            territoryId,
            newOwnerId,
          }),
        },
      })
    })

    revalidatePath('/admin/territories')
    return { success: true }
  } catch (err: any) {
    console.error('[transferTerritory] Error:', err)
    return {
      success: false,
      error: err?.message || '转让领地失败',
    }
  }
}

export interface DeleteTerritoryResponse {
  success: boolean
  error?: string
}

export async function deleteTerritory(
  territoryId: string
): Promise<DeleteTerritoryResponse> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.territory_hp_logs.deleteMany({
        where: { territory_id: territoryId },
      })

      await tx.territories.delete({
        where: { id: territoryId },
      })

      await tx.admin_logs.create({
        data: {
          action: 'delete_territory',
          details: JSON.stringify({
            territoryId,
          }),
        },
      })
    })

    revalidatePath('/admin/territories')
    return { success: true }
  } catch (err: any) {
    console.error('[deleteTerritory] Error:', err)
    return {
      success: false,
      error: err?.message || '删除领地失败',
    }
  }
}
