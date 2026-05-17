'use server'

import { getCityById } from '@/lib/city-data'
import { prisma } from '@/lib/prisma'

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
    health?: number | null
    score_weight?: number
    territory_type?: string
    lastAttackedAt?: Date | string | null
    customName?: string | null
}

export async function getTerritoryDetail(
    territoryId: string,
    _options?: { ownerId?: string; clubId?: string; sourceRunId?: string | null }
): Promise<TerritoryDetailResult | null> {
    let territory: any = null;

    try {
        const data = await prisma.territories.findUnique({
            where: { id: territoryId },
            select: {
                id: true,
                city_id: true,
                area_m2_exact: true,
                captured_at: true,
                owner_id: true,
                source_run_id: true,
                current_hp: true,
                health: true,
                last_attacked_at: true,
                score_weight: true,
                territory_type: true,
                owner_faction: true,
                custom_name: true,
                profiles: {
                    select: {
                        id: true,
                        nickname: true,
                        avatar_url: true
                    }
                },
                clubs: {
                    select: {
                        id: true,
                        name: true,
                        avatar_url: true
                    }
                }
            }
        });

        if (!data) {
            return null;
        }
        territory = data;
    } catch (error) {
        console.error('Failed to fetch territory detail from Prisma:', error);
        return null;
    }

    const areaKm2 = Number(((territory.area_m2_exact || 0) / 1_000_000).toFixed(4))

    // Resolve city name
    const city = getCityById(territory.city_id)
    const cityName = city?.name || '未知城市'

    const result: TerritoryDetailResult = {
        territoryId,
        cityName,
        capturedAt: territory.captured_at instanceof Date ? territory.captured_at.toISOString() : territory.captured_at,
        area: areaKm2,
        owner: null,
        club: null,
        recentRun: null,
        current_hp: territory.current_hp || 1000,
        health: territory.health ?? territory.current_hp ?? 100,
        score_weight: territory.score_weight || 1.0,
        territory_type: territory.territory_type || 'NORMAL',
        lastAttackedAt: territory.last_attacked_at ?? null,
        customName: territory.custom_name || null,
        status: 'success'
    }

    if (!territory.owner_id) {
        return result // Neutral territory
    }

    if (territory.profiles) {
        result.owner = {
            id: territory.profiles.id,
            nickname: territory.profiles.nickname || '神秘领主',
            avatarUrl: territory.profiles.avatar_url
        }
    } else if (territory.owner_id) {
        // 🔴 Corrected: Proactive fallback fetch if join failed but owner_id exists
        try {
            const profile = await prisma.profiles.findUnique({
                where: { id: territory.owner_id },
                select: { id: true, nickname: true, avatar_url: true }
            });
            result.owner = {
                id: territory.owner_id,
                nickname: profile?.nickname || '神秘领主',
                avatarUrl: profile?.avatar_url || null
            };
        } catch (e) {
            result.owner = { id: territory.owner_id, nickname: '神秘领主', avatarUrl: null };
        }
    }

    // 3. Map Club Info
    if (territory.clubs) {
        result.club = {
            id: territory.clubs.id,
            name: territory.clubs.name,
            logoUrl: territory.clubs.avatar_url // prisma uses avatar_url for clubs
        }
    }

    // 4. Fetch the specific run that captured this territory (Legacy fallback to recent if missing)
    try {
        let captureRun = null;
        if (territory.source_run_id) {
            captureRun = await prisma.runs.findUnique({
                where: { id: territory.source_run_id },
                select: { id: true, distance: true, duration: true }
            });
        }
        
        if (!captureRun) {
            const recentRuns = await prisma.runs.findMany({
                where: { user_id: territory.owner_id },
                orderBy: { created_at: 'desc' },
                take: 1,
                select: { id: true, distance: true, duration: true }
            });
            captureRun = recentRuns[0] || null;
        }

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
    } catch (e) {
        console.error('Failed to fetch run data for territory detail:', e);
    }

    return result
}
