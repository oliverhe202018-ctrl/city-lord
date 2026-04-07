"use client";

import { useEffect, useRef, useMemo } from 'react';
import * as turf from '@turf/turf';
import type { Feature, Polygon, MultiPolygon } from 'geojson';

export interface ClaimedPolygon {
    lat: number;
    lng: number;
    timestamp: number;
}

interface ClaimedPolygonLayerProps {
    map: any | null;
    polygons: ClaimedPolygon[][];
    fillColor?: string;
    fillOpacity?: number;
    strokeColor?: string;
    strokeWeight?: number;
}

/**
 * ClaimedPolygonLayer: Renders semi-transparent claimed territories
 * 
 * Displays all polygons claimed during the current run session.
 * Rendered UNDER the TrajectoryLayer (lower z-index).
 * 
 * Visual Style:
 * - Gold/Amber fill (#F59E0B) with 0.3 opacity
 * - Subtle thin border (strokeWeight: 1)
 * - Distinct from blue trajectory line
 */
export function ClaimedPolygonLayer({
    map,
    polygons,
    fillColor = '#F59E0B', // Gold/Amber
    fillOpacity = 0.3,
    strokeColor = '#D97706', // Darker amber for border
    strokeWeight = 1
}: ClaimedPolygonLayerProps) {
    const polygonRefs = useRef<any[]>([]);

    const polygonCount = polygons?.length || 0;

    const mergedPolygonPaths = useMemo(() => {
        if (!polygons || polygons.length === 0) return [];
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

            if (turfPolys.length === 0) return [];
            
            let merged = turfPolys[0] as Feature<Polygon | MultiPolygon>;
            for (let i = 1; i < turfPolys.length; i++) {
                const combined = turf.union(turf.featureCollection([merged, turfPolys[i]]));
                if (combined) {
                    merged = combined as Feature<Polygon | MultiPolygon>;
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

            return amapPaths;
        } catch (e) {
            console.error('[ClaimedPolygonLayer] Error during turf.union', e);
            return polygons.filter(p => p.length >= 3).map(p => {
                const coords = p.map(pt => [pt.lng, pt.lat]);
                if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
                    coords.push([...coords[0]]);
                }
                return coords;
            });
        }
    }, [polygonCount, polygons]);


    useEffect(() => {
        if (!map || !window.AMap) return;

        // Clear existing polygons
        polygonRefs.current.forEach(poly => {
            if (poly) map?.remove?.(poly);
        });
        polygonRefs.current = [];

        // Render all merged polygons
        mergedPolygonPaths.forEach((amapPath) => {
            // Create polygon overlay
// @ts-expect-error - Baseline exemption for pre-existing schema mismatch - [Ticket-202603-SchemaSync] baseline exemption
            const poly = new window.AMap.Polygon({
                path: amapPath,
                fillColor,
                fillOpacity,
                strokeColor,
                strokeWeight,
                strokeOpacity: 0.6,
                zIndex: 40, // BELOW TrajectoryLayer (zIndex: 50)
            });

            map.add(poly);
            polygonRefs.current.push(poly);
        });

        return () => {
            // Cleanup on unmount
            if (map) {
                polygonRefs.current.forEach(poly => {
                    if (poly) {
                        try {
                            map?.remove?.(poly);
                        } catch (e) {
                            console.warn('[ClaimedPolygonLayer] Cleanup error:', e);
                        }
                    }
                });
            }
            polygonRefs.current = [];
        };
    }, [map, mergedPolygonPaths, fillColor, fillOpacity, strokeColor, strokeWeight]);

    return null;
}
