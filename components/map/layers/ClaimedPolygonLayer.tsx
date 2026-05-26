"use client";

import { useEffect, useRef, useMemo } from 'react';
import * as turf from '@turf/turf';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import { useGameTerritoryAppearance } from '@/store/useGameStore';

export interface ClaimedPolygon {
    lat: number;
    lng: number;
    timestamp: number;
}

interface ClaimedPolygonLayerProps {
    map: any | null;
    polygons: ClaimedPolygon[][];
    fillOpacity?: number;
    strokeWeight?: number;
    currentZoom?: number;
}

function polygonsAreEqual(a: ClaimedPolygon[][], b: ClaimedPolygon[][]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i].length !== b[i].length) return false;
        for (let j = 0; j < a[i].length; j++) {
            if (a[i][j].lat !== b[i][j].lat || a[i][j].lng !== b[i][j].lng) return false;
        }
    }
    return true;
}

function pathsAreEqual(a: number[][][], b: number[][][]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i].length !== b[i].length) return false;
        for (let j = 0; j < a[i].length; j++) {
            if (a[i][j].length !== b[i][j].length) return false;
            for (let k = 0; k < a[i][j].length; k++) {
                if (Math.abs(a[i][j][k] - b[i][j][k]) > 0.00005) return false;
            }
        }
    }
    return true;
}

export const ClaimedPolygonLayer = function ClaimedPolygonLayer({
    map,
    polygons,
    fillOpacity = 0.3,
    strokeWeight = 1,
    currentZoom = 13
}: ClaimedPolygonLayerProps) {
    const { territoryAppearance } = useGameTerritoryAppearance();
    const fillColor = territoryAppearance.fillColor || '#F59E0B';
    const strokeColor = territoryAppearance.strokeColor || '#D97706';
    const overlayPoolRef = useRef<Map<string, any>>(new Map());
    const prevPathsRef = useRef<number[][][]>([]);
    const lastSuccessfulPathsRef = useRef<number[][][]>([]);

    const mergedPolygonPaths = useMemo(() => {
        if (!polygons || polygons.length === 0) return [];
        console.log('🔮 [ClaimedPolygonLayer] mergedPolygonPaths trigger, polygons count:', polygons.length);
        try {
            const turfPolys = polygons
                .filter(p => p.length >= 3)
                .map(p => {
                    const coords = p.map(pt => [pt.lng, pt.lat] as [number, number]);
                    const first = coords[0];
                    const last = coords[coords.length - 1];
                    if (first[0] !== last[0] || first[1] !== last[1]) {
                        coords.push([...first]);
                    }
                    return turf.polygon([coords]);
                });

            console.log('🔮 [ClaimedPolygonLayer] turfPolys created count:', turfPolys.length);
            if (turfPolys.length === 0) return lastSuccessfulPathsRef.current;

            let merged = turfPolys[0] as Feature<Polygon | MultiPolygon>;
            for (let i = 1; i < turfPolys.length; i++) {
                try {
                    const combined = turf.union(turf.featureCollection([merged, turfPolys[i]]));
                    if (combined) {
                        merged = combined as Feature<Polygon | MultiPolygon>;
                    }
                } catch (e) {
                    console.warn('[Turf Error] 跳过非法多边形合并', e);
                }
            }

            const amapPaths: number[][][] = [];
            if (merged.geometry.type === 'Polygon') {
                amapPaths.push(merged.geometry.coordinates[0] as number[][]);
            } else if (merged.geometry.type === 'MultiPolygon') {
                merged.geometry.coordinates.forEach((polyCoords: any) => {
                    amapPaths.push(polyCoords[0] as number[][]);
                });
            }

            console.log('🔮 [ClaimedPolygonLayer] amapPaths generated count:', amapPaths.length);
            if (amapPaths.length > 0) {
                lastSuccessfulPathsRef.current = amapPaths;
            }
            return amapPaths;
        } catch (e) {
            console.error('[ClaimedPolygonLayer] Error during turf.union', e);
            return lastSuccessfulPathsRef.current;
        }
    }, [polygons]);

    useEffect(() => {
        if (!map || !window.AMap) {
            console.log('🔮 [ClaimedPolygonLayer] useEffect early exit: map or window.AMap not ready');
            return;
        }
        console.log('🔮 [ClaimedPolygonLayer] useEffect trigger, currentZoom:', currentZoom, 'mergedPolygonPaths count:', mergedPolygonPaths.length);
        
        // 优雅控制显隐：监听 currentZoom 的变化
        if (currentZoom < 10) {
            overlayPoolRef.current.forEach((overlay) => overlay.hide?.());
        } else {
            overlayPoolRef.current.forEach((overlay) => overlay.show?.());
        }

        prevPathsRef.current = mergedPolygonPaths;

        const currentPaths = mergedPolygonPaths;
        const currentPathIds = currentPaths.map((path, index) => {
            if (path.length > 0 && path[0].length >= 2) {
                return `polygon-${path[0][0].toFixed(5)}-${path[0][1].toFixed(5)}`;
            }
            return `polygon-fallback-${index}`;
        });
        const currentIdSet = new Set(currentPathIds);
        
        overlayPoolRef.current.forEach((overlay, id) => {
            if (!currentIdSet.has(id)) {
                try {
                    console.log('🔮 [ClaimedPolygonLayer] Removing outdated polygon overlay:', id);
                    map?.remove?.(overlay);
                    overlay.destroy?.();
                    overlayPoolRef.current.delete(id);
                } catch (e) {
                    console.warn('[ClaimedPolygonLayer] Cleanup error:', e);
                }
            }
        });
        
        currentPaths.forEach((amapPath, index) => {
            const id = currentPathIds[index];
            
            // Map coordinates from number[] to AMap.LngLat objects
            const lngLatPath = amapPath.map(pt => new window.AMap.LngLat(pt[0], pt[1]));
            console.log(`🔮 [ClaimedPolygonLayer] Rendering polygon ID: ${id}, points count: ${lngLatPath.length}`);
            
            if (overlayPoolRef.current.has(id)) {
                const existingOverlay = overlayPoolRef.current.get(id);
                if (existingOverlay && existingOverlay.setPath) {
                    existingOverlay.setPath(lngLatPath);
                    console.log(`🔮 [ClaimedPolygonLayer] Updated existing polygon path for ID: ${id}`);
                }
            } else {
                // @ts-expect-error - Baseline exemption for pre-existing schema mismatch - [Ticket-202603-SchemaSync] baseline exemption
                const poly = new window.AMap.Polygon({
                    path: lngLatPath,
                    fillColor,
                    fillOpacity,
                    strokeColor,
                    strokeWeight,
                    strokeOpacity: 0.6,
                    zIndex: 130, // Render on top of FogLayer (zIndex: 100)
                });

                if (currentZoom < 10) {
                    poly.hide?.();
                }

                map.add(poly);
                overlayPoolRef.current.set(id, poly);
                console.log(`🔮 [ClaimedPolygonLayer] Created new AMap.Polygon and added to map for ID: ${id}`);
            }
        });

        return () => {
            if (map) {
                overlayPoolRef.current.forEach((overlay) => {
                    try {
                        map?.remove?.(overlay);
                        overlay.destroy?.();
                    } catch (e) {
                        console.warn('[ClaimedPolygonLayer] Cleanup error:', e);
                    }
                });
                overlayPoolRef.current.clear();
            }
        };
    }, [map, mergedPolygonPaths, fillColor, fillOpacity, strokeColor, strokeWeight, currentZoom]);

    return null;
};

export default ClaimedPolygonLayer;
