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

        // 必须使用 plugin 异步加载高德图层插件
        window.AMap.plugin(['AMap.Polyline'], () => {
            // 第二层防并发重入防线
            if (polylineRef.current) return;

            polylineRef.current = new window.AMap.Polyline({
                path: [],
                strokeColor,
                strokeWeight,
                borderWeight: 1,
                isOutline: true,
                outlineColor: '#ffffff',
                lineJoin: 'round',
                lineCap: 'round',
            });

            map.add(polylineRef.current);
        });

        return () => {
            if (map && polylineRef.current) {
                map.remove(polylineRef.current);
                polylineRef.current.destroy?.();
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
        const amapPath = path
            .filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng))
            .map(p => [p.lng, p.lat] as [number, number]);
        if (amapPath.length === 0) {
            polylineRef.current.setPath([]);
            return;
        }
        polylineRef.current.setPath(amapPath);
    }, [path]);

    return null;
}
