"use client";

import { useEffect, useRef } from 'react';

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

    useEffect(() => {
        if (!map || !window.AMap) return;

        // Clear existing polygons
        polygonRefs.current.forEach(poly => {
            if (poly) map?.remove?.(poly);
        });
        polygonRefs.current = [];

        // Render all claimed polygons
        polygons.forEach((polygon) => {
            if (polygon.length < 3) return; // Need at least 3 points

            // Convert to AMap format [[lng, lat], ...]
            const amapPath = polygon.map(p => [p.lng, p.lat]);

            // Ensure closed ring
            const first = amapPath[0];
            const last = amapPath[amapPath.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) {
                amapPath.push(first);
            }

            // Create polygon overlay
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
    }, [map, polygons, fillColor, fillOpacity, strokeColor, strokeWeight]);

    return null;
}
