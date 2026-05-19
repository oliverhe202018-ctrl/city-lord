'use server'

/**
 * Admin Territory Management — Server Actions
 *
 * Provides list, reset-HP, transfer-ownership, and delete
 * operations for the admin territories page.
 * All actions require a valid admin session.
 *
 * SCHEMA-ALIGNED: uses current_hp, area_m2_exact, owner_faction
 */

import { createClient } from '@/lib/supabase/server'
import { requireAdminSession } from '@/lib/admin/auth'
import {
  normalizePaginationParams,
  calcSkip,
  paginatedSuccess,
  paginatedError,
  type PaginationParams,
  type PaginatedResponse,
} from '@/lib/admin/pagination'
import { MAX_TERRITORY_HP } from '@/lib/constants/territory'

// ============================================================
// Types
// ============================================================

export interface TerritoryAdminRow {
  id: string
  city_id: string
  owner_id: string | null
  owner_name: string | null
  /** owner_faction from territories table */
  faction: string | null
  /** current_hp mapped for UI */
  hp: number
  /** max_hp for display */
  max_hp: number
  /** area_m2_exact mapped for UI */
  area_m2: number | null
  created_at: string
  updated_at: string
}

export interface ListTerritoriesParams extends PaginationParams {
  cityId?: string
  ownerId?: string
  /** 'neutral' | 'owned' | 'all' */
  status?: string
  /** Filter territories with HP below this value */
  maxHp?: number
  search?: string
}

export interface ActionResult {
  success: boolean
  error?: string
  message?: string
}

// ============================================================
// List Territories
// ============================================================

export async function adminListTerritories(
  params: ListTerritoriesParams = {},
): Promise<PaginatedResponse<TerritoryAdminRow>> {
  try {
    await requireAdminSession()
    const { page, pageSize } = normalizePaginationParams(params)
    const skip = calcSkip(page, pageSize)

    const supabase = createClient()

    let query = supabase
      .from('territories')
      .select(
        `
        id,
        city_id,
        owner_id,
        current_hp,
        max_hp,
        area_m2_exact,
        owner_faction,
        created_at,
        updated_at,
        owner:profiles!territories_owner_id_fkey(id, nickname)
        `,
        { count: 'exact' },
      )

    if (params.cityId) query = query.eq('city_id', params.cityId)
    if (params.ownerId) query = query.eq('owner_id', params.ownerId)
    if (params.status === 'neutral') query = query.is('owner_id', null)
    if (params.status === 'owned') query = query.not('owner_id', 'is', null)
    if (params.maxHp !== undefined) query = query.lte('current_hp', params.maxHp)
    if (params.search) {
      query = query.ilike('id', `%${params.search}%`)
    }

    const { data, error, count } = await query
      .order('updated_at', { ascending: false })
      .range(skip, skip + pageSize - 1)

    if (error) return paginatedError(error.message)

    const rows: TerritoryAdminRow[] = (data ?? []).map((t: any) => ({
      id: t.id,
      city_id: t.city_id,
      owner_id: t.owner_id ?? null,
      owner_name: t.owner?.nickname ?? null,
      faction: t.owner_faction ?? null,
      hp: t.current_hp ?? 0,
      max_hp: t.max_hp ?? MAX_TERRITORY_HP,
      area_m2: t.area_m2_exact ?? null,
      created_at: t.created_at,
      updated_at: t.updated_at,
    }))

    return paginatedSuccess(rows, count ?? 0, page, pageSize)
  } catch (err: any) {
    return paginatedError(err?.message ?? 'Unknown error')
  }
}

// ============================================================
// Reset Territory HP
// ============================================================

export async function adminResetTerritoryHp(
  territoryId: string,
  mode: 'full' | 'hp-only' = 'full',
): Promise<ActionResult> {
  try {
    await requireAdminSession()
    const supabase = createClient()

    const updatePayload: Record<string, unknown> = {
      current_hp: MAX_TERRITORY_HP,
    }

    const { error } = await supabase
      .from('territories')
      .update(updatePayload)
      .eq('id', territoryId)

    if (error) return { success: false, error: error.message }
    return { success: true, message: `HP 已重置为 ${MAX_TERRITORY_HP}` }
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Unknown error' }
  }
}

// ============================================================
// Transfer Territory Ownership
// ============================================================

export async function adminTransferTerritory(
  territoryId: string,
  newOwnerId: string,
): Promise<ActionResult> {
  try {
    await requireAdminSession()
    const supabase = createClient()

    // Verify target profile exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, faction')
      .eq('id', newOwnerId)
      .single()

    if (profileError || !profile) {
      return { success: false, error: '目标用户不存在' }
    }

    const { error } = await supabase
      .from('territories')
      .update({
        owner_id: newOwnerId,
        owner_faction: profile.faction ?? null,
      })
      .eq('id', territoryId)

    if (error) return { success: false, error: error.message }
    return { success: true, message: '所有权已转让' }
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Unknown error' }
  }
}

// ============================================================
// Delete Territory
// ============================================================

export async function adminDeleteTerritory(
  territoryId: string,
): Promise<ActionResult> {
  try {
    await requireAdminSession()
    const supabase = createClient()

    const { error } = await supabase
      .from('territories')
      .delete()
      .eq('id', territoryId)

    if (error) return { success: false, error: error.message }
    return { success: true, message: '领地已删除' }
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Unknown error' }
  }
}
