"use client";

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { safeLoadAMap, safeDestroyMap } from '@/lib/map/safe-amap';
import type { AMapInstance } from '@/components/map/AMapContext';

export interface MapLayerProps {
    initialCenter: [number, number];
    initialZoom: number;
    onMoveEnd?: (center: [number, number]) => void;
    onZoomEnd?: (zoom: number) => void;
    onMapLoad?: () => void;
    onMapReady?: (map: AMapInstance | null) => void;
    mapStyle?: string;
}

export interface MapLayerHandle {
    map: any | null;
    flyTo: (center: [number, number], zoom?: number, duration?: number) => void;
    getCenter: () => [number, number] | null;
}

/**
 * MapLayer: Pure map rendering component
 * 
 * Responsibilities:
 * - Initialize AMap instance
 * - Handle map events (move, zoom)
 * - Emit events to parent
 * - NO GPS logic, NO state management
 */
export const MapLayer = forwardRef<MapLayerHandle, MapLayerProps>(
    ({ initialCenter, initialZoom, onMoveEnd, onZoomEnd, onMapLoad, onMapReady, mapStyle }, ref) => {
        const mapDomRef = useRef<HTMLDivElement>(null);
        const mapRef = useRef<any>(null);

        useImperativeHandle(ref, () => ({
            map: mapRef.current,
            flyTo: (center, zoom = 17, duration = 1000) => {
                if (!mapRef.current) return;
                // AMap 2.0: setZoomAndCenter(zoom, center, immediately, duration)
                mapRef.current.setZoomAndCenter(zoom, center, true, duration);
            },
            getCenter: () => {
                if (!mapRef.current) return null;
                const c = mapRef.current.getCenter();
                return [c.lng, c.lat];
            }
        }));

        useEffect(() => {
            let destroyed = false;

            (async () => {
                const AMap = await safeLoadAMap({ plugins: ["AMap.Scale", "AMap.MoveAnimation"] });
                if (destroyed || !mapDomRef.current || !AMap) return;

                mapRef.current = new AMap.Map(mapDomRef.current, {
                    zoom: initialZoom,
                    center: initialCenter,
                    viewMode: "2D",
                    mapStyle: mapStyle || 'amap://styles/22e069175d1afe32e9542abefde02cb5',
                    showLabel: true,
                });

                // Emit center changes (reverse data flow)
                if (onMoveEnd) {
                    mapRef.current.on('moveend', () => {
                        const center = mapRef.current.getCenter();
                        onMoveEnd([center.lng, center.lat]);
                    });
                }

                if (onZoomEnd) {
                    mapRef.current.on('zoomend', () => {
                        onZoomEnd(mapRef.current.getZoom());
                    });
                }

                // Notify parent that map is loaded
                if (onMapLoad) {
                    onMapLoad();
                }

                // Expose map instance to parent
                if (onMapReady) {
                    onMapReady(mapRef.current);
                }
            })();

            return () => {
                destroyed = true;
                safeDestroyMap(mapRef.current);
                mapRef.current = null;
            };
        }, []); // Init once

        return <div ref={mapDomRef} className="w-full h-full" style={{ touchAction: 'none' }} />;
    }
);

MapLayer.displayName = 'MapLayer';
