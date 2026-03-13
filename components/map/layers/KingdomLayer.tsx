"use client";

import { useEffect, useRef, useState } from 'react';
import { getUserKingdom, type KingdomPolygon } from '@/app/actions/user-service';
import { useMapInteraction } from '@/components/map/MapInteractionContext';
import { latLngToCell, gridDisk } from 'h3-js';
import type { ExtTerritory } from '@/types/city';

interface KingdomLayerProps {
    map: any | null;
    userId: string | null;
}

/**
 * KingdomLayer: Renders user's historical claimed territories
 * 
 * Displays all polygons from past runs with a subtle gold overlay.
 * Now also supports click-to-select via H3 reverse lookup.
 */
export function KingdomLayer({ map, userId }: KingdomLayerProps) {
    const [polygons, setPolygons] = useState<KingdomPolygon[]>([]);
    const [loading, setLoading] = useState(false);
    const polygonRefs = useRef<any[]>([]);
    const { setSelectedTerritory, kingdomMode } = useMapInteraction();

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
                    fillOpacity: 0.2,
                    strokeColor: '#D97706',
                    strokeWeight: 1,
                    strokeOpacity: 0.8,
                    zIndex: 35,
                    bubble: false, // 拦截点击事件，不冒泡到 map
                    cursor: 'pointer',
                });

                // 点击领地色块 → 构造最小 ExtTerritory → 触发详情
                poly.on('click', (e: any) => {
                    if (!e?.lnglat) return;
                    const lat = e.lnglat.lat;
                    const lng = e.lnglat.lng;
                    
                    // 用点击坐标的 H3 cellId 作为领地 ID
                    const cellId = latLngToCell(lat, lng, 9);
                    
                    console.log(`[Audit] ★ KINGDOM CLICK ★ lnglat=${lng},${lat} cellId=${cellId}`);
                    
                    // 构造最小的 ExtTerritory 对象供 InfoBar/DetailSheet 使用
                    const syntheticTerritory: ExtTerritory = {
                        id: cellId,
                        cityId: '', // 将由 detail API 填充
                        ownerId: userId,
                        ownerType: 'me',
                        capturedAt: polygon.claimedAt || null,
                    };
                    
                    (window as any).__amap_polygon_clicked = Date.now();
                    setSelectedTerritory?.(syntheticTerritory);
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
    }, [map, polygons, userId, setSelectedTerritory]);

    return null;
}

