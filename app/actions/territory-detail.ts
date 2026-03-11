'use server'

import { createClient } from '@/lib/supabase/server'
import { getCityById } from '@/lib/city-data'
import { cellArea } from 'h3-js'

export interface TerritoryDetailResult {
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
    } | null
    recentRun: {
        distanceKm: number
        durationStr: string
        paceMinPerKm: string
    } | null
}

export async function getTerritoryDetail(territoryId: string): Promise<TerritoryDetailResult | null> {
    const supabase = await createClient()

    // 1. Fetch territory data
    const { data: territory, error: terrError } = await supabase
        .from('territories')
        .select('owner_id, city_id, captured_at, owner_club_id')
        .eq('id', territoryId)
        .single()

    if (terrError || !territory) {
        console.error('Failed to fetch territory detail:', terrError)
        return null
    }

    // Calculate area from H3 index
    const areaKm2 = cellArea(territoryId, 'km2')

    // Resolve city name
    const city = getCityById(territory.city_id)
    const cityName = city?.name || '未知城市'

    const result: TerritoryDetailResult = {
        territoryId,
        cityName,
        capturedAt: territory.captured_at,
        area: Number(areaKm2.toFixed(2)),
        owner: null,
        club: null,
        recentRun: null
    }

    if (!territory.owner_id) {
        return result // Neutral territory
    }

    // 2. Fetch owner profile
    const { data: profile } = await supabase
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
        const { data: club } = await supabase
            .from('clubs')
            .select('id, name')
            .eq('id', territory.owner_club_id)
            .single()

        if (club) {
            result.club = {
                id: club.id,
                name: club.name
            }
        }
    }

    // 4. Fetch recent run (MVP option B: owner's most recent run)
    const { data: recentRun } = await supabase
        .from('runs')
        .select('distance, duration')
        .eq('user_id', territory.owner_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (recentRun) {
        // distance from DB is in meters, duration in seconds
        const distanceKm = (recentRun.distance || 0) / 1000

        // Format duration (MM:SS or HH:MM:SS)
        const hours = Math.floor(recentRun.duration / 3600)
        const minutes = Math.floor((recentRun.duration % 3600) / 60)
        const seconds = recentRun.duration % 60
        let durationStr = ''
        if (hours > 0) {
            durationStr += `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        } else {
            durationStr += `${minutes}:${seconds.toString().padStart(2, '0')}`
        }

        // Format pace (MM'SS")
        let paceStr = '--\'--"'
        if (distanceKm > 0 && recentRun.duration > 0) {
            const paceSecondsPerKm = recentRun.duration / distanceKm
            const paceMins = Math.floor(paceSecondsPerKm / 60)
            const paceSecs = Math.floor(paceSecondsPerKm % 60)
            paceStr = `${paceMins}'${paceSecs.toString().padStart(2, '0')}"`
        }

        result.recentRun = {
            distanceKm: Number(distanceKm.toFixed(2)),
            durationStr,
            paceMinPerKm: paceStr
        }
    }

    return result
}
