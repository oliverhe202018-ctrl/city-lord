'use server'

/**
 * Admin Territory Management — Server Actions
 *
 * Provides list, reset-HP, transfer-ownership, and delete
 * operations for the admin territories page.
 * All actions require a valid admin session.
 */

import { createClient } from '@/lib/supabase/client-server'
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

// ==============================================================
// Types
// ==============================================================

export interface TerritoryAdminRow {
  id: string
  city_id: string
  owner_id: string | null
  owner_name: string | null
  faction: string | null
  hp: number
  shield: number
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

// ==============================================================
// List Territories
// ==============================================================

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
      .select(`
        id, city_id, hp, shield, area_m2, created_at, updated_at,
        owner:users!territories_owner_id_fkey(id, display_name, faction)
      `, { count: 'exact' })

    if (params.cityId) query = query.eq('city_id', params.cityId)
    if (params.ownerId) query = query.eq('owner_id', params.ownerId)
    if (params.status === 'neutral') query = query.is('owner_id', null)
    if (params.status === 'owned') query = query.not('owner_id', 'is', null)
    if (params.maxHp !== undefined) query = query.lte('hp', params.maxHp)

    const { data, error, count } = await query
      .order('updated_at', { ascending: false })
      .range(skip, skip + pageSize - 1)

    if (error) throw error

    const rows: TerritoryAdminRow[] = (data ?? []).map((t: any) => ({
      id: t.id,
      city_id: t.city_id,
      owner_id: t.owner?.id ?? null,
      owner_name: t.owner?.display_name ?? null,
      faction: t.owner?.faction ?? null,
      hp: t.hp,
      shield: t.shield ?? 0,
      area_m2: t.area_m2 ?? null,
      created_at: t.created_at,
      updated_at: t.updated_at,
    }))

    return paginatedSuccess(rows, count ?? 0, page, pageSize)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return paginatedError(msg)
  }
}

// ==============================================================
// Reset Territory HP
// ==============================================================

export async function adminResetTerritoryHp(
  territoryId: string,
  /** 'full' resets HP + shield; 'hp-only' resets only HP */
  mode: 'full' | 'hp-only' = 'full',
): Promise<ActionResult> {
  try {
    await requireAdminSession()
    const supabase = createClient()

    const update: Record<string, number> = { hp: MAX_TERRITORY_HP }
    if (mode === 'full') update.shield = 0

    const { error } = await supabase
      .from('territories')
      .update(update)
      .eq('id', territoryId)

    if (error) throw error

    await supabase.from('admin_logs').insert({
      action: 'RESET_TERRITORY_HP',
      target_id: territoryId,
      meta: { mode },
    })

    return { success: true, message: `HP reset (${mode}) for territory ${territoryId}` }
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ==============================================================
// Transfer Territory Ownership
// ==============================================================

export async function adminTransferTerritory(
  territoryId: string,
  newOwnerId: string,
): Promise<ActionResult> {
  try {
    await requireAdminSession()
    const supabase = createClient()

    // Verify new owner exists
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id')
      .eq('id', newOwnerId)
      .single()

    if (userErr || !user) return { success: false, error: 'Target user not found' }

    const { error } = await supabase
      .from('territories')
      .update({ owner_id: newOwnerId })
      .eq('id', territoryId)

    if (error) throw error

    await supabase.from('admin_logs').insert({
      action: 'TRANSFER_TERRITORY',
      target_id: territoryId,
      meta: { new_owner_id: newOwnerId },
    })

    return { success: true, message: 'Territory transferred' }
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ==============================================================
// Delete Territory
// ==============================================================

export async function adminDeleteTerritory(
  territoryId: string,
): Promise<ActionResult> {
  try {
    await requireAdminSession()
    const supabase = createClient()

    // Cascade: delete HP logs first, then the territory
    await supabase
      .from('territory_hp_logs')
      .delete()
      .eq('territory_id', territoryId)

    const { error } = await supabase
      .from('territories')
      .delete()
      .eq('id', territoryId)

    if (error) throw error

    await supabase.from('admin_logs').insert({
      action: 'DELETE_TERRITORY',
      target_id: territoryId,
      meta: {},
    })

    return { success: true, message: 'Territory deleted' }
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
