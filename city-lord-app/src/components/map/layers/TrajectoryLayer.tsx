/// <reference types="@amap/amap-jsapi-types" />
import { useEffect, useRef } from 'react';
import { type GeoPoint } from '@/hooks/useSafeGeolocation';

interface TrajectoryLayerProps {
    map: AMap.Map | null;
    path: GeoPoint[];
    strokeColor?: string;
    strokeWeight?: number;
}

const TELEPORT_DISTANCE_M = 100; // gap threshold to start a new segment

function haversineMeters(a: GeoPoint, b: GeoPoint): number {
    const R = 6371000;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const c = sinDLat * sinDLat + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinDLng * sinDLng;
    return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

export function TrajectoryLayer({ map, path, strokeColor = '#3B82F6', strokeWeight = 6 }: TrajectoryLayerProps) {
    // Each "segment" is a Polyline plus a mutable raw-point array (for setPath updates)
    const segmentsRef = useRef<{ polyline: AMap.Polyline; rawPoints: GeoPoint[] }[]>([]);
    // Track how many path points we have already rendered
    const renderedCountRef = useRef(0);
    // Track last rendered color/weight to detect prop changes
    const styleRef = useRef({ strokeColor, strokeWeight });

    // Full rebuild when map instance changes or style changes
    const fullRebuildNeeded = useRef(false);
    if (styleRef.current.strokeColor !== strokeColor || styleRef.current.strokeWeight !== strokeWeight) {
        styleRef.current = { strokeColor, strokeWeight };
        fullRebuildNeeded.current = true;
    }

    useEffect(() => {
        if (!map || !window.AMap) return;
        // Full rebuild: happens on map mount, unmount, or style change
        const destroy = () => {
            segmentsRef.current.forEach(({ polyline }) => {
                try { map.remove(polyline); polyline.destroy?.(); } catch (_) {}
            });
            segmentsRef.current = [];
            renderedCountRef.current = 0;
        };
        destroy();
        fullRebuildNeeded.current = false;
        return destroy;
    }, [map, strokeColor, strokeWeight]);

    useEffect(() => {
        if (!map || !window.AMap) return;
        if (!path || path.length === 0) return;

        const polylineOptions = {
            strokeColor,
            strokeWeight,
            borderWeight: 1,
            isOutline: true,
            outlineColor: '#ffffff',
            lineJoin: 'round' as const,
            lineCap: 'round' as const,
        };

        const alreadyRendered = renderedCountRef.current;

        // Detection for path clearing, replacing, or shortening (e.g. simplified path)
        if (alreadyRendered > 0) {
            let needsRebuild = false;
            if (path.length < alreadyRendered) {
                needsRebuild = true;
            } else {
                // Check if the last rendered point still matches (detect array swap with different points)
                const lastSeg = segmentsRef.current[segmentsRef.current.length - 1];
                if (lastSeg && lastSeg.rawPoints.length > 0) {
                    const lastRenderedPt = lastSeg.rawPoints[lastSeg.rawPoints.length - 1];
                    const correspondingPathPt = path[alreadyRendered - 1];
                    if (
                        !correspondingPathPt ||
                        Math.abs(lastRenderedPt.lat - correspondingPathPt.lat) > 0.00001 ||
                        Math.abs(lastRenderedPt.lng - correspondingPathPt.lng) > 0.00001
                    ) {
                        needsRebuild = true;
                    }
                }
            }

            if (needsRebuild) {
                segmentsRef.current.forEach(({ polyline }) => {
                    try { map.remove(polyline); polyline.destroy?.(); } catch (_) {}
                });
                segmentsRef.current = [];
                renderedCountRef.current = 0;
            }
        }

        const currentAlreadyRendered = renderedCountRef.current;

        if (currentAlreadyRendered === 0) {
            // First render — build all segments from scratch
            const segments: GeoPoint[][] = [];
            let cur: GeoPoint[] = [];
            for (const pt of path) {
                if (!pt || !Number.isFinite(pt.lat) || !Number.isFinite(pt.lng)) continue;
                if (cur.length > 0) {
                    const dist = haversineMeters(cur[cur.length - 1], pt);
                    if (dist > TELEPORT_DISTANCE_M) { segments.push(cur); cur = []; }
                }
                cur.push(pt);
            }
            if (cur.length > 0) segments.push(cur);

            segmentsRef.current = segments.map(rawPoints => {
                const polyline = new window.AMap.Polyline({
                    ...polylineOptions,
                    path: rawPoints.map(p => new window.AMap.LngLat(p.lng, p.lat)),
                });
                map.add(polyline);
                return { polyline, rawPoints };
            });
            renderedCountRef.current = path.length;
            return;
        }

        // Incremental append — only process new points
        const newPoints = path.slice(currentAlreadyRendered);
        if (newPoints.length === 0) return;

        for (const pt of newPoints) {
            if (!pt || !Number.isFinite(pt.lat) || !Number.isFinite(pt.lng)) continue;

            const segs = segmentsRef.current;
            if (segs.length === 0) {
                // No segments yet — create first
                const polyline = new window.AMap.Polyline({
                    ...polylineOptions,
                    path: [new window.AMap.LngLat(pt.lng, pt.lat)],
                });
                map.add(polyline);
                segmentsRef.current = [{ polyline, rawPoints: [pt] }];
                continue;
            }

            const lastSeg = segs[segs.length - 1];
            const lastPt = lastSeg.rawPoints[lastSeg.rawPoints.length - 1];
            const dist = haversineMeters(lastPt, pt);

            if (dist > TELEPORT_DISTANCE_M) {
                // Large gap — start a new segment
                const polyline = new window.AMap.Polyline({
                    ...polylineOptions,
                    path: [new window.AMap.LngLat(pt.lng, pt.lat)],
                });
                map.add(polyline);
                segmentsRef.current.push({ polyline, rawPoints: [pt] });
            } else {
                // Append to existing last segment
                lastSeg.rawPoints.push(pt);
                lastSeg.polyline.setPath(
                    lastSeg.rawPoints.map(p => new window.AMap.LngLat(p.lng, p.lat))
                );
            }
        }
        renderedCountRef.current = path.length;

    }, [map, path, strokeColor, strokeWeight]);

    return null;
}
