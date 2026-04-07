'use server'

import { createClient } from '@/lib/supabase/server'
import { getCityById } from '@/lib/city-data'
import { supabaseAdmin } from '@/lib/supabase/admin'

export interface TerritoryDetailResult {
    status?: 'pending' | 'success'
    territoryId: string
    cityName: string
    capturedAt: string | null
    area: number
    owner: {
        id: string
        nickname: string
        avatarUrl: string | null
    } | null
    club: {
        id: string
        name: string
        logoUrl: string | null
    } | null
    recentRun: {
        id?: string
        distanceKm: number
        durationStr: string
        paceMinPerKm: string
    } | null
    current_hp?: number
    score_weight?: number
    territory_type?: string
}

export async function getTerritoryDetail(
    territoryId: string,
    options?: { ownerId?: string; clubId?: string; sourceRunId?: string }
): Promise<TerritoryDetailResult | null> {
    const supabase = await createClient()

    let territory: any = null;

    if (territoryId === 'legacy') {
        if (!options?.ownerId) {
            return null; // Cannot forge without owner
        }
        territory = {
            id: 'legacy',
            owner_id: options.ownerId,
            city_id: 'default',
            captured_at: new Date().toISOString(),
            owner_club_id: options.clubId || null,
            current_hp: 1000,
            score_weight: 1.0,
            territory_type: 'NORMAL',
            source_run_id: options.sourceRunId || null,
            area_m2_exact: 0 // Will show as 0 on mocked legacy unless passed, but the map layer calculates it dynamically anyway.
        };
    } else {
        // 1. Fetch territory data
        const { data, error: terrError } = await supabaseAdmin
            .from('territories')
            .select('owner_id, city_id, captured_at, owner_club_id, current_hp, score_weight, territory_type, source_run_id, area_m2_exact')
            .eq('id', territoryId)
            .single()

        if (terrError || !data) {
            console.error('Failed to fetch territory detail:', terrError)
            return { territoryId, status: 'pending' } as any
        }
        territory = data;
    }

    const areaKm2 = Number(((territory.area_m2_exact || 0) / 1_000_000).toFixed(4))

    // Resolve city name
    const city = getCityById(territory.city_id)
    const cityName = city?.name || '未知城市'

    const result: TerritoryDetailResult = {
        territoryId,
        cityName,
        capturedAt: territory.captured_at,
        area: areaKm2,
        owner: null,
        club: null,
        recentRun: null,
        current_hp: territory.current_hp || 1000,
        score_weight: territory.score_weight || 1.0,
        territory_type: territory.territory_type || 'NORMAL'
    }

    if (!territory.owner_id) {
        return result // Neutral territory
    }

    // 2. Fetch owner profile
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, nickname, avatar_url')
        .eq('id', territory.owner_id)
        .single()

    if (profile) {
        result.owner = {
            id: profile.id,
            nickname: profile.nickname || '神秘领主',
            avatarUrl: profile.avatar_url
        }
    } else {
        // Fallback if profile is somehow missing
        result.owner = {
            id: territory.owner_id,
            nickname: '神秘领主',
            avatarUrl: null
        }
    }

    // 3. Fetch club info if applicable
    if (territory.owner_club_id) {
        const { data: club } = await supabaseAdmin
            .from('clubs')
            .select('id, name, logo_url')
            .eq('id', territory.owner_club_id)
            .single()

        if (club) {
            result.club = {
                id: club.id,
                name: club.name,
                logoUrl: club.logo_url
            }
        }
    }

    // 4. Fetch the specific run that captured this territory (Legacy fallback to recent if missing)
    let runQuery = supabaseAdmin.from('runs').select('id, distance, duration');
    
    if (territory.source_run_id) {
        runQuery = runQuery.eq('id', territory.source_run_id);
    } else {
        runQuery = runQuery.eq('user_id', territory.owner_id).order('created_at', { ascending: false });
    }
    
    const { data: captureRun } = await runQuery.limit(1).single();

    if (captureRun) {
        // distance from DB is in meters, duration in seconds
        const distanceKm = (captureRun.distance || 0) / 1000

        // Format duration (MM:SS or HH:MM:SS)
        const hours = Math.floor(captureRun.duration / 3600)
        const minutes = Math.floor((captureRun.duration % 3600) / 60)
        const seconds = captureRun.duration % 60
        let durationStr = ''
        if (hours > 0) {
            durationStr += `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        } else {
            durationStr += `${minutes}:${seconds.toString().padStart(2, '0')}`
        }

        // Format pace (MM'SS")
        let paceStr = '--\'--"'
        if (distanceKm > 0 && captureRun.duration > 0) {
            const paceSecondsPerKm = captureRun.duration / distanceKm
            const paceMins = Math.floor(paceSecondsPerKm / 60)
            const paceSecs = Math.floor(paceSecondsPerKm % 60)
            paceStr = `${paceMins}'${paceSecs.toString().padStart(2, '0')}"`
        }

        result.recentRun = {
            id: captureRun.id,
            distanceKm: Number(distanceKm.toFixed(2)),
            durationStr,
            paceMinPerKm: paceStr
        }
    }

    return result
}
