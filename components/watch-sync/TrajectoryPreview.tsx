'use client';

/**
 * TrajectoryPreview
 * 
 * Renders a static preview of uploaded watch trajectory data on an AMap instance.
 * This component is loaded via next/dynamic with ssr: false to prevent
 * Hydration Mismatch errors from the AMap SDK.
 * 
 * Does NOT use MapRoot/AMapContext — it's a standalone lightweight map.
 */

import { useEffect, useRef, useState } from 'react';
import type { WatchTrackPoint } from '@/types/watch-sync';

// ============================================================
// Types
// ============================================================

interface TrajectoryPreviewProps {
    points: WatchTrackPoint[];
    isTerritoryCreated: boolean;
    territoryArea?: number;
}

// ============================================================
// AMap Loader
// ============================================================

const AMAP_KEY = process.env.NEXT_PUBLIC_AMAP_KEY || '';

function loadAMapScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        if ((window as unknown as Record<string, unknown>).AMap) {
            resolve();
            return;
        }

        const existing = document.getElementById('amap-script');
        if (existing) {
            existing.addEventListener('load', () => resolve());
            return;
        }

        const script = document.createElement('script');
        script.id = 'amap-script';
        script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}`;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('AMap SDK 加载失败'));
        document.head.appendChild(script);
    });
}

// ============================================================
// Component
// ============================================================

export default function TrajectoryPreview({
    points,
    isTerritoryCreated,
    territoryArea,
}: TrajectoryPreviewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<unknown>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!containerRef.current || points.length === 0) return;

        let mounted = true;

        const initMap = async () => {
            try {
                await loadAMapScript();
                if (!mounted || !containerRef.current) return;

                const AMap = (window as unknown as Record<string, unknown>).AMap as Record<string, unknown>;
                if (!AMap) {
                    setError('AMap SDK 未加载');
                    return;
                }

                // Calculate bounds
                const lats = points.map(p => p.lat);
                const lngs = points.map(p => p.lng);
                const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
                const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

                // Create map instance
                const MapConstructor = AMap.Map as new (
                    container: HTMLDivElement,
                    options: Record<string, unknown>
                ) => Record<string, unknown>;

                const map = new MapConstructor(containerRef.current, {
                    center: [centerLng, centerLat],
                    zoom: 15,
                    viewMode: '2D',
                    mapStyle: 'amap://styles/dark',
                });

                mapInstanceRef.current = map;

                // Create trajectory polyline
                const pathCoords = points.map(p => [p.lng, p.lat]);

                const PolylineConstructor = AMap.Polyline as new (
                    options: Record<string, unknown>
                ) => Record<string, unknown>;

                const polyline = new PolylineConstructor({
                    path: pathCoords,
                    strokeColor: '#3B82F6',
                    strokeWeight: 4,
                    strokeOpacity: 0.9,
                    lineJoin: 'round',
                    lineCap: 'round',
                    zIndex: 50,
                });

                (map.add as (overlay: unknown) => void)(polyline);

                // If territory was created, draw the filled polygon
                if (isTerritoryCreated) {
                    const polygonPath = [...pathCoords];
                    // Ensure closed ring
                    if (
                        polygonPath[0][0] !== polygonPath[polygonPath.length - 1][0] ||
                        polygonPath[0][1] !== polygonPath[polygonPath.length - 1][1]
                    ) {
                        polygonPath.push(polygonPath[0]);
                    }

                    const PolygonConstructor = AMap.Polygon as new (
                        options: Record<string, unknown>
                    ) => Record<string, unknown>;

                    const polygon = new PolygonConstructor({
                        path: polygonPath,
                        fillColor: '#22c55e',
                        fillOpacity: 0.25,
                        strokeColor: '#16a34a',
                        strokeWeight: 2,
                        strokeOpacity: 0.8,
                        zIndex: 40,
                    });

                    (map.add as (overlay: unknown) => void)(polygon);
                }

                // Add start marker
                const MarkerConstructor = AMap.Marker as new (
                    options: Record<string, unknown>
                ) => Record<string, unknown>;

                const startMarker = new MarkerConstructor({
                    position: [points[0].lng, points[0].lat],
                    content: '<div style="width:12px;height:12px;border-radius:50%;background:#22c55e;border:2px solid white;box-shadow:0 0 6px rgba(34,197,94,0.5);"></div>',
                    offset: [-6, -6],
                    zIndex: 60,
                });

                const endMarker = new MarkerConstructor({
                    position: [points[points.length - 1].lng, points[points.length - 1].lat],
                    content: '<div style="width:12px;height:12px;border-radius:50%;background:#ef4444;border:2px solid white;box-shadow:0 0 6px rgba(239,68,68,0.5);"></div>',
                    offset: [-6, -6],
                    zIndex: 60,
                });

                (map.add as (overlay: unknown) => void)(startMarker);
                (map.add as (overlay: unknown) => void)(endMarker);

                // Fit map to show all points
                try {
                    (map.setFitView as (overlays?: unknown[]) => void)();
                } catch {
                    // Ignore fit view errors
                }

                setIsLoading(false);
            } catch (e) {
                if (mounted) {
                    setError(e instanceof Error ? e.message : '地图加载失败');
                    setIsLoading(false);
                }
            }
        };

        initMap();

        return () => {
            mounted = false;
            if (mapInstanceRef.current) {
                try {
                    const map = mapInstanceRef.current as Record<string, unknown>;
                    if (typeof map.destroy === 'function') {
                        (map.destroy as () => void)();
                    }
                } catch {
                    // Ignore cleanup errors
                }
                mapInstanceRef.current = null;
            }
        };
    }, [points, isTerritoryCreated, territoryArea]);

    if (error) {
        return (
            <div className="flex h-64 items-center justify-center bg-muted/30 text-sm text-muted-foreground">
                ❌ {error}
            </div>
        );
    }

    return (
        <div className="relative">
            <div
                ref={containerRef}
                className="h-80 w-full"
                style={{ minHeight: '320px' }}
            />
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/50 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        加载地图中...
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-3 left-3 flex gap-3 rounded-lg bg-background/80 px-3 py-2 text-xs backdrop-blur-sm">
                <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                    起点
                </span>
                <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                    终点
                </span>
                {isTerritoryCreated && (
                    <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-sm bg-green-500/50" />
                        领地 ({Math.round(territoryArea || 0)}m²)
                    </span>
                )}
            </div>
        </div>
    );
}
