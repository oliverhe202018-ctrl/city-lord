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
 * TrajectoryLayer: Real-time GPS trajectory polyline with tracking-gap splitting
 * 
 * Renders outline-styled polylines as the user runs. Updates in real-time.
 * If a large gap (e.g. time gap > 30s AND distance gap > 50m) occurs,
 * it splits the polyline to avoid rendering visual diagonal lines across the map.
 */
export function TrajectoryLayer({
    map,
    path,
    strokeColor = '#3B82F6',
    strokeWeight = 6
}: TrajectoryLayerProps) {
    const polylinesRef = useRef<AMap.Polyline[]>([]);

    useEffect(() => {
        if (!map || !window.AMap) return;

        // Clear existing polylines
        polylinesRef.current.forEach(p => {
            try {
                map.remove(p);
                p.destroy?.();
            } catch (e) {
                console.warn('[TrajectoryLayer] Failed to remove polyline:', e);
            }
        });
        polylinesRef.current = [];

        if (!path || path.length === 0) return;

        // Split path into segments based on gap thresholds
        const segments: AMap.LngLat[][] = [];
        let currentSegment: AMap.LngLat[] = [];
        let lastValidPt: GeoPoint | null = null;

        for (let i = 0; i < path.length; i++) {
            const pt = path[i];
            if (!pt || !Number.isFinite(pt.lat) || !Number.isFinite(pt.lng)) continue;

            const amapPt = new window.AMap.LngLat(pt.lng, pt.lat);

            if (lastValidPt !== null && currentSegment.length > 0) {
                const timeDiff = ((pt.timestamp || 0) - (lastValidPt.timestamp || 0)) / 1000; // in seconds
                
                let distance = 0;
                if (window.AMap?.GeometryUtil?.distance) {
                    distance = window.AMap.GeometryUtil.distance(
                        [lastValidPt.lng, lastValidPt.lat],
                        [pt.lng, pt.lat]
                    );
                } else {
                    distance = Math.sqrt(
                        Math.pow((pt.lat - lastValidPt.lat) * 111000, 2) +
                        Math.pow((pt.lng - lastValidPt.lng) * 111000 * Math.cos(pt.lat * Math.PI / 180), 2)
                    );
                }

                // If gap is large (e.g. time gap > 30s AND distance gap > 50m), split
                if (timeDiff > 30 && distance > 50) {
                    if (currentSegment.length > 0) {
                        segments.push(currentSegment);
                        currentSegment = [];
                    }
                }
            }
            currentSegment.push(amapPt);
            lastValidPt = pt;
        }
        if (currentSegment.length > 0) {
            segments.push(currentSegment);
        }

        // Create and add polylines for each segment
        const polylineOptions: any = {
            strokeColor,
            strokeWeight,
            borderWeight: 1,
            isOutline: true,
            outlineColor: '#ffffff',
            lineJoin: 'round',
            lineCap: 'round',
        };

        const newPolylines = segments
            .filter(seg => seg.length > 0)
            .map(seg => {
                const p = new window.AMap.Polyline({
                    ...polylineOptions,
                    path: seg
                });
                map.add(p);
                return p;
            });

        polylinesRef.current = newPolylines;

        return () => {
            newPolylines.forEach(p => {
                if (map) {
                    try {
                        map.remove(p);
                        p.destroy?.();
                    } catch (e) {
                        // ignore
                    }
                }
            });
            polylinesRef.current = [];
        };
    }, [map, path, strokeColor, strokeWeight]);

    return null;
}
