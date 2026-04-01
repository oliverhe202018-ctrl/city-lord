/// <reference types="@amap/amap-jsapi-types" />
import { useEffect, useRef } from 'react';
import { GeoPoint } from '@/hooks/useSafeGeolocation';

interface TrajectoryLayerProps {
    map: AMap.Map | null;
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
    const polylineRef = useRef<AMap.Polyline | null>(null);

    useEffect(() => {
        if (!map || !window.AMap) return;
        if (polylineRef.current) return;
        polylineRef.current = new window.AMap.Polyline({
            path: [],
            strokeColor,
            strokeWeight,
            strokeOpacity: 0.9,
            zIndex: 50,
            lineJoin: 'round',
            lineCap: 'round',
        });
        map.add(polylineRef.current);

        return () => {
            if (polylineRef.current) {
                map?.remove?.(polylineRef.current);
                polylineRef.current = null;
            }
        };
    }, [map, strokeColor, strokeWeight]);

    useEffect(() => {
        if (!polylineRef.current) return;
        if (!path || path.length === 0) {
            polylineRef.current.setPath([]);
            return;
        }
        const amapPath = path.map(p => [p.lng, p.lat] as [number, number]);
        polylineRef.current.setPath(amapPath);
    }, [path]);

    return null;
}
