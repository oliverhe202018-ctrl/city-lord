'use server'

import { prisma } from '@/lib/prisma'

export interface ClubKingdomPolygon {
    coordinates: { lat: number; lng: number }[];
}

export interface ClubKingdomData {
    clubName: string;
    clubLogoUrl: string;
    polygons: ClubKingdomPolygon[];
}

/**
 * getClubKingdom: 获取用户所属俱乐部的全部领地数据
 * 
 * 1. 查找用户所在俱乐部
 * 2. 获取俱乐部所有成员的 Run Polygon
 * 3. 返回俱乐部Logo + 所有polygon坐标
 */
export async function getClubKingdom(userId: string): Promise<ClubKingdomData | null> {
    try {
        // 1. Find user's club
        const profile = await prisma.profiles.findUnique({
            where: { id: userId },
            select: { club_id: true }
        });

        if (!profile?.club_id) return null;

        // 2. Get club info (logo)
        const club = await prisma.clubs.findUnique({
            where: { id: profile.club_id },
            select: {
                name: true,
                avatar_url: true,
            }
        });

        if (!club) return null;

        // 3. Get all club member IDs
        const members = await prisma.club_members.findMany({
            where: {
                club_id: profile.club_id,
                status: 'active'
            },
            select: { user_id: true }
        });

        const memberIds = members.map(m => m.user_id);

        // 4. Get all runs with polygons from club members
        const runs = await prisma.runs.findMany({
            where: {
                user_id: { in: memberIds },
                polygons: { not: undefined }
            },
            select: { polygons: true },
            orderBy: { created_at: 'desc' },
            take: 200 // Performance limit
        });

        // 5. Flatten polygons
        const allPolygons: ClubKingdomPolygon[] = [];
        runs.forEach(run => {
            if (run.polygons && Array.isArray(run.polygons)) {
                (run.polygons as any[]).forEach(poly => {
                    if (Array.isArray(poly) && poly.length >= 3) {
                        allPolygons.push({
                            coordinates: poly.map((p: any) => ({
                                lat: p.lat,
                                lng: p.lng
                            }))
                        });
                    }
                });
            }
        });

        return {
            clubName: club.name,
            clubLogoUrl: club.avatar_url || '/default-club-logo.png',
            polygons: allPolygons,
        };
    } catch (error) {
        console.error('Failed to fetch club kingdom:', error);
        return null;
    }
}

import * as turf from '@turf/turf';

export interface TopTerritoryCardData {
    id: string;
    custom_name: string;
    area: number;
    center: [number, number]; // [lng, lat]
    health: number;
    ownerName: string;
    polygonPoints?: [number, number][]; // 边界多边形坐标，用于前台 FitView
}

/**
 * getClubTopTerritories: 获取某个俱乐部面积最大的 Top N 活跃领地，服务于社交排行地图联动
 */
export async function getClubTopTerritories(clubId: string, limit: number = 5): Promise<TopTerritoryCardData[]> {
    try {
        const territories = await prisma.territories.findMany({
            where: {
                owner_club_id: clubId,
                status: 'ACTIVE'
            },
            orderBy: { area_m2_exact: 'desc' },
            take: limit,
            select: {
                id: true,
                custom_name: true,
                area_m2_exact: true,
                health: true,
                geojson_json: true,
                profiles: {
                    select: {
                        nickname: true
                    }
                }
            }
        });

        return territories.map(t => {
            let center: [number, number] = [116.397428, 39.90923]; // 默认北京
            let polygonPoints: [number, number][] = [];

            try {
                const geo = t.geojson_json as any;
                let ring: [number, number][] = [];

                if (geo && geo.type === 'Polygon') {
                    ring = geo.coordinates[0];
                } else if (geo && geo.type === 'MultiPolygon') {
                    ring = geo.coordinates[0][0];
                }

                if (ring && ring.length >= 3) {
                    polygonPoints = ring.map((pt: any) => [Number(pt[0]), Number(pt[1])]);
                    const poly = turf.polygon([ring]);
                    const centroid = turf.centroid(poly);
                    if (centroid && centroid.geometry && centroid.geometry.coordinates) {
                        center = centroid.geometry.coordinates as [number, number];
                    }
                }
            } catch (e) {
                console.error(`[getClubTopTerritories] Geometry parse error for territory ${t.id}:`, e);
            }

            return {
                id: t.id,
                custom_name: t.custom_name || '未命名领地',
                area: Math.round(Number(t.area_m2_exact || 0)),
                center,
                health: t.health || 100,
                ownerName: t.profiles?.nickname || '神秘领主',
                polygonPoints
            };
        });
    } catch (error) {
        console.error('Failed to fetch club top territories:', error);
        return [];
    }
}

/**
 * getUserTopTerritories: 获取某个用户面积最大的 Top N 活跃领地，服务于社交排行地图联动
 */
export async function getUserTopTerritories(userId: string, limit: number = 5): Promise<TopTerritoryCardData[]> {
    try {
        const territories = await prisma.territories.findMany({
            where: {
                owner_id: userId,
                status: 'ACTIVE'
            },
            orderBy: { area_m2_exact: 'desc' },
            take: limit,
            select: {
                id: true,
                custom_name: true,
                area_m2_exact: true,
                health: true,
                geojson_json: true,
                profiles: {
                    select: {
                        nickname: true
                    }
                }
            }
        });

        return territories.map(t => {
            let center: [number, number] = [116.397428, 39.90923];
            let polygonPoints: [number, number][] = [];

            try {
                const geo = t.geojson_json as any;
                let ring: [number, number][] = [];

                if (geo && geo.type === 'Polygon') {
                    ring = geo.coordinates[0];
                } else if (geo && geo.type === 'MultiPolygon') {
                    ring = geo.coordinates[0][0];
                }

                if (ring && ring.length >= 3) {
                    polygonPoints = ring.map((pt: any) => [Number(pt[0]), Number(pt[1])]);
                    const poly = turf.polygon([ring]);
                    const centroid = turf.centroid(poly);
                    if (centroid && centroid.geometry && centroid.geometry.coordinates) {
                        center = centroid.geometry.coordinates as [number, number];
                    }
                }
            } catch (e) {
                console.error(`[getUserTopTerritories] Geometry parse error for territory ${t.id}:`, e);
            }

            return {
                id: t.id,
                custom_name: t.custom_name || '未命名领地',
                area: Math.round(Number(t.area_m2_exact || 0)),
                center,
                health: t.health || 100,
                ownerName: t.profiles?.nickname || '神秘领主',
                polygonPoints
            };
        });
    } catch (error) {
        console.error('Failed to fetch user top territories:', error);
        return [];
    }
}
