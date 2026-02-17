"use client";

import { useEffect, useRef, useState } from 'react';
import { getUserKingdom, type KingdomPolygon } from '@/app/actions/user-service';

interface KingdomLayerProps {
    map: any | null;
    userId: string | null;
}

/**
 * KingdomLayer: Renders user's historical claimed territories
 * 
 * Displays all polygons from past runs with a subtle gold overlay.
 * Lower opacity and z-index than current session claims to create "historical" feel.
 * 
 * Visual Style:
 * - Gold fill (#F59E0B) with 0.2 opacity (vs 0.3 for session claims)
 * - No stroke (strokeWeight: 0) to reduce visual clutter
 * - zIndex: 35 (below session claims at 40)
 */
export function KingdomLayer({ map, userId }: KingdomLayerProps) {
    const [polygons, setPolygons] = useState<KingdomPolygon[]>([]);
    const [loading, setLoading] = useState(false);
    const polygonRefs = useRef<any[]>([]);

    // Fetch kingdom data when userId changes
    useEffect(() => {
        if (!userId) return;

        setLoading(true);
        getUserKingdom(userId)
            .then(data => {
                setPolygons(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to load kingdom:', err);
                setLoading(false);
            });
    }, [userId]);

    // Render polygons on map
    useEffect(() => {
        if (!map || !window.AMap) return;

        // Clear existing polygons
        polygonRefs.current.forEach(poly => {
            if (poly) map?.remove?.(poly);
        });
        polygonRefs.current = [];

        // Render kingdom polygons
        polygons.forEach((polygon) => {
            if (!polygon.coordinates || polygon.coordinates.length < 3) return;

            try {
                // Convert to AMap format [[lng, lat], ...]
                const amapPath = polygon.coordinates.map(p => [p.lng, p.lat]);

                // Ensure closed ring
                const first = amapPath[0];
                const last = amapPath[amapPath.length - 1];
                if (first[0] !== last[0] || first[1] !== last[1]) {
                    amapPath.push(first);
                }

                // Create polygon overlay
                const poly = new window.AMap.Polygon({
                    path: amapPath,
                    fillColor: '#F59E0B', // Gold
                    fillOpacity: 0.2, // Lower than session claims (0.3)
                    strokeWeight: 0, // No border for cleaner look
                    strokeOpacity: 0,
                    zIndex: 35, // Below session claims (40) and trajectory (50)
                });

                map.add(poly);
                polygonRefs.current.push(poly);
            } catch (e) {
                console.warn('Failed to render kingdom polygon:', e);
            }
        });

        return () => {
            // Cleanup on unmount
            if (map) {
                polygonRefs.current.forEach(poly => {
                    if (poly) {
                        try {
                            map?.remove?.(poly);
                        } catch (e) {
                            console.warn('[KingdomLayer] Cleanup error:', e);
                        }
                    }
                });
            }
            polygonRefs.current = [];
        };
    }, [map, polygons]);

    return null;
}
