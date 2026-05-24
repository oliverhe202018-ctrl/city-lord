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
        // 第一层防重防线
        if (polylineRef.current) return;

        const polylineOptions: any = {
            strokeColor,
            strokeWeight,
            borderWeight: 1,
            isOutline: true,
            outlineColor: '#ffffff',
            lineJoin: 'round',
            lineCap: 'round',
        };

        const initialAmapPath = (path || [])
            .filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng))
            .map(p => new window.AMap.LngLat(p.lng, p.lat));

        if (initialAmapPath.length > 0) {
            polylineOptions.path = initialAmapPath;
        }

        polylineRef.current = new window.AMap.Polyline(polylineOptions);

        map.add(polylineRef.current);

        return () => {
            if (map && polylineRef.current) {
                map.remove(polylineRef.current);
                polylineRef.current.destroy?.();
                polylineRef.current = null;
            }
        };
    }, [map, strokeColor, strokeWeight]);

    useEffect(() => {
        if (!polylineRef.current || !window.AMap) return;
        if (!path || path.length === 0) {
            polylineRef.current.setPath([]);
            return;
        }
        const amapPath = path
            .filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng))
            .map(p => new window.AMap.LngLat(p.lng, p.lat));
        polylineRef.current.setPath(amapPath);
    }, [path]);

    return null;
}
