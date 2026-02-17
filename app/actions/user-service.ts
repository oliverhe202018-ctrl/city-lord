'use server'

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export interface KingdomPolygon {
    coordinates: Array<{ lat: number; lng: number }>;
    area?: number;
    claimedAt?: string;
}

/**
 * Fetch user's historical claimed territories (Kingdom)
 * Returns all polygons from recent runs for map visualization
 */
export async function getUserKingdom(userId: string): Promise<KingdomPolygon[]> {
    try {
        // Fetch last 50 runs with polygons (performance limit)
        const runs = await prisma.runs.findMany({
            where: {
                user_id: userId,
                polygons: {
                    not: Prisma.DbNull
                }
            },
            select: {
                polygons: true,
                created_at: true
            },
            orderBy: { created_at: 'desc' },
            take: 50
        });

        // Parse and flatten all polygons
        const allPolygons: KingdomPolygon[] = [];

        runs.forEach(run => {
            if (!run.polygons) return;

            try {
                // Handle different JSON structures safely
                const polygonData = run.polygons as any;

                // If it's already an array of polygon objects
                if (Array.isArray(polygonData)) {
                    polygonData.forEach((poly: any) => {
                        // Case 1: Array of coordinate arrays [[{lat, lng}], [{lat, lng}], ...]
                        if (Array.isArray(poly) && poly.length > 0 && poly[0]?.lat !== undefined) {
                            allPolygons.push({
                                coordinates: poly.map((p: any) => ({ lat: p.lat, lng: p.lng })),
                                claimedAt: run.created_at?.toISOString()
                            });
                        }
                        // Case 2: Polygon object with coordinates field
                        else if (poly.coordinates && Array.isArray(poly.coordinates)) {
                            allPolygons.push({
                                coordinates: poly.coordinates.map((p: any) => ({ lat: p.lat, lng: p.lng })),
                                area: poly.area,
                                claimedAt: poly.claimedAt || run.created_at?.toISOString()
                            });
                        }
                    });
                }
            } catch (e) {
                // Silently skip malformed polygon data
                console.warn('Failed to parse polygon data for run:', run.created_at, e);
            }
        });

        return allPolygons;
    } catch (error) {
        console.error('Failed to fetch kingdom:', error);
        return [];
    }
}
