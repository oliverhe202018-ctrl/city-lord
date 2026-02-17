"use client";

import { useEffect, useRef } from 'react';
import { GeoPoint } from '@/hooks/useSafeGeolocation';

interface TrajectoryLayerProps {
    map: any | null;
    path: GeoPoint[];
    strokeColor?: string;
    strokeWeight?: number;
}

/**
 * TrajectoryLayer: Real-time GPS trajectory polyline
 * 
 * Renders blue polyline as user runs. Updates in real-time.
 * This is the SOURCE OF TRUTH for territory claims in running game.
 */
export function TrajectoryLayer({
    map,
    path,
    strokeColor = '#3B82F6',
    strokeWeight = 6
}: TrajectoryLayerProps) {
    const polylineRef = useRef<any>(null);

    useEffect(() => {
        if (!map || !window.AMap) return;

        // Capture map ref at effect creation time to avoid stale closure
        const mapInstance = map;

        // Convert GeoPoint[] to AMap path format [[lng, lat], ...]
        const amapPath = path.map(p => [p.lng, p.lat]);

        if (amapPath.length === 0) {
            // No path yet, remove existing polyline if any
            if (polylineRef.current) {
                mapInstance?.remove?.(polylineRef.current);
                polylineRef.current = null;
            }
            return;
        }

        if (!polylineRef.current) {
            // Create new polyline
            polylineRef.current = new window.AMap.Polyline({
                path: amapPath,
                strokeColor,
                strokeWeight,
                strokeOpacity: 0.9,
                zIndex: 50,
                lineJoin: 'round',
                lineCap: 'round',
            });
            mapInstance?.add?.(polylineRef.current);
        } else {
            // Update existing polyline path
            polylineRef.current.setPath(amapPath);
        }

        return () => {
            if (polylineRef.current) {
                // Safe cleanup: map instance may already be destroyed
                mapInstance?.remove?.(polylineRef.current);
                polylineRef.current = null;
            }
        };
    }, [map, path, strokeColor, strokeWeight]);

    return null;
}
