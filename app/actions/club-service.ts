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
