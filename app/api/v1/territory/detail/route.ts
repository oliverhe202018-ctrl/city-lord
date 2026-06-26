import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { prisma } from '@/lib/prisma';
import { getCityById } from '@/lib/city-data';

export interface TerritoryDetailResult {
    status?: 'pending' | 'success';
    territoryId: string;
    cityName: string;
    capturedAt: string | null;
    area: number;
    owner: {
        id: string;
        nickname: string;
        avatarUrl: string | null;
        backgroundUrl: string | null;
    } | null;
    club: {
        id: string;
        name: string;
        logoUrl: string | null;
    } | null;
    recentRun: {
        id?: string;
        distanceKm: number;
        durationStr: string;
        paceMinPerKm: string;
    } | null;
    current_hp?: number;
    health?: number | null;
    shield?: number;
    score_weight?: number;
    territory_type?: string;
    lastAttackedAt?: Date | string | null;
    customName?: string | null;
}

export async function GET(request: NextRequest) {
  try {
    // [P5 Fix] JWT 验签
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const territoryId = searchParams.get('territoryId');

    if (!territoryId) {
      return NextResponse.json({ error: 'territoryId required' }, { status: 400 });
    }

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
                shield: true,
                last_attacked_at: true,
                score_weight: true,
                territory_type: true,
                owner_faction: true,
                custom_name: true,
                profiles: {
                    select: {
                        id: true,
                        nickname: true,
                        avatar_url: true,
                        background_url: true
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
            return NextResponse.json({ success: true, data: null });
        }
        territory = data;
    } catch (error) {
        console.error('Failed to fetch territory detail from Prisma:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch territory' },
            { status: 500 }
        );
    }

    const areaKm2 = Number(((territory.area_m2_exact || 0) / 1_000_000).toFixed(4));

    // Resolve city name
    const city = getCityById(territory.city_id);
    const cityName = city?.name || '未知城市';

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
        shield: territory.shield ?? 0,
        score_weight: territory.score_weight || 1.0,
        territory_type: territory.territory_type || 'NORMAL',
        lastAttackedAt: territory.last_attacked_at ?? null,
        customName: territory.custom_name || null,
        status: 'success'
    };

    if (!territory.owner_id) {
        return NextResponse.json({ success: true, data: result });
    }

    if (territory.profiles) {
        result.owner = {
            id: territory.profiles.id,
            nickname: territory.profiles.nickname || '神秘领主',
            avatarUrl: territory.profiles.avatar_url,
            backgroundUrl: territory.profiles.background_url ?? null
        };
    } else if (territory.owner_id) {
        try {
            const profile = await prisma.profiles.findUnique({
                where: { id: territory.owner_id },
                select: { id: true, nickname: true, avatar_url: true, background_url: true }
            });
            result.owner = {
                id: territory.owner_id,
                nickname: profile?.nickname || '神秘领主',
                avatarUrl: profile?.avatar_url || null,
                backgroundUrl: profile?.background_url ?? null
            };
        } catch (e) {
            result.owner = { id: territory.owner_id, nickname: '神秘领主', avatarUrl: null, backgroundUrl: null };
        }
    }

    // Map Club Info
    if (territory.clubs) {
        result.club = {
            id: territory.clubs.id,
            name: territory.clubs.name,
            logoUrl: territory.clubs.avatar_url
        };
    }

    // Fetch the specific run that captured this territory
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
            const distanceKm = (captureRun.distance || 0) / 1000;

            const hours = Math.floor(captureRun.duration / 3600);
            const minutes = Math.floor((captureRun.duration % 3600) / 60);
            const seconds = captureRun.duration % 60;
            let durationStr = '';
            if (hours > 0) {
                durationStr += `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            } else {
                durationStr += `${minutes}:${seconds.toString().padStart(2, '0')}`;
            }

            let paceStr = '--\'--"';
            if (distanceKm > 0 && captureRun.duration > 0) {
                const paceSecondsPerKm = captureRun.duration / distanceKm;
                const paceMins = Math.floor(paceSecondsPerKm / 60);
                const paceSecs = Math.floor(paceSecondsPerKm % 60);
                paceStr = `${paceMins}'${paceSecs.toString().padStart(2, '0')}"`;
            }

            result.recentRun = {
                id: captureRun.id,
                distanceKm: Number(distanceKm.toFixed(2)),
                durationStr,
                paceMinPerKm: paceStr
            };
        }
    } catch (e) {
        console.error('Failed to fetch run data for territory detail:', e);
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[GET /api/v1/territory/detail] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch territory detail' },
      { status: 500 }
    );
  }
}
