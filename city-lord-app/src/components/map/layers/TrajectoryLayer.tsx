/// <reference types="@amap/amap-jsapi-types" />
import { useEffect, useRef } from 'react';
import { type GeoPoint } from '@/hooks/useSafeGeolocation';

interface TrajectoryLayerProps {
    map: AMap.Map | null;
    path: GeoPoint[];
    strokeColor?: string;
    strokeWeight?: number;
}

const TELEPORT_DISTANCE_M = 100;

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
    const segmentsRef = useRef<{ polyline: AMap.Polyline; rawPoints: GeoPoint[] }[]>([]);
    const renderedCountRef = useRef(0);
    const styleRef = useRef({ strokeColor, strokeWeight });
    const fullRebuildNeeded = useRef(false);

    if (styleRef.current.strokeColor !== strokeColor || styleRef.current.strokeWeight !== strokeWeight) {
        styleRef.current = { strokeColor, strokeWeight };
        fullRebuildNeeded.current = true;
    }

    useEffect(() => {
        if (!map || !window.AMap) return;
        const destroy = () => {
            segmentsRef.current.forEach(({ polyline }) => {
                try { if (polyline) { map.remove(polyline); polyline.destroy?.(); } } catch (_) {}
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

        if (alreadyRendered === 0) {
            const segments: GeoPoint[][] = [];
            let cur: GeoPoint[] = [];
            for (const pt of path) {
                if (!pt) continue;
                if (!Number.isFinite(pt.lat) || !Number.isFinite(pt.lng)) {
                    if (cur.length > 0) { segments.push(cur); cur = []; }
                    continue;
                }
                if (cur.length > 0) {
                    const dist = haversineMeters(cur[cur.length - 1], pt);
                    if (dist > TELEPORT_DISTANCE_M || (pt as any).gap) { segments.push(cur); cur = []; }
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

        const newPoints = path.slice(alreadyRendered);
        if (newPoints.length === 0) return;

        for (const pt of newPoints) {
            if (!pt) continue;
            
            if (!Number.isFinite(pt.lat) || !Number.isFinite(pt.lng)) {
                const segs = segmentsRef.current;
                if (segs.length > 0 && segs[segs.length - 1].rawPoints.length > 0) {
                    segs.push({ polyline: null as any, rawPoints: [] });
                }
                continue;
            }

            const segs = segmentsRef.current;
            if (segs.length === 0 || !segs[segs.length - 1].polyline) {
                const polyline = new window.AMap.Polyline({
                    ...polylineOptions,
                    path: [new window.AMap.LngLat(pt.lng, pt.lat)],
                });
                map.add(polyline);
                if (segs.length > 0 && !segs[segs.length - 1].polyline) {
                    segs.pop();
                }
                segmentsRef.current.push({ polyline, rawPoints: [pt] });
                continue;
            }

            const lastSeg = segs[segs.length - 1];
            const lastPt = lastSeg.rawPoints[lastSeg.rawPoints.length - 1];
            const dist = haversineMeters(lastPt, pt);

            if (dist > TELEPORT_DISTANCE_M || (pt as any).gap) {
                const polyline = new window.AMap.Polyline({
                    ...polylineOptions,
                    path: [new window.AMap.LngLat(pt.lng, pt.lat)],
                });
                map.add(polyline);
                segmentsRef.current.push({ polyline, rawPoints: [pt] });
            } else {
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
