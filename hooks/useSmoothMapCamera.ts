/// <reference types="@amap/amap-jsapi-types" />
import { useCallback, useRef } from 'react';

interface UserZoomOverride {
    zoom: number;
    expiresAt: number;
}

export function useSmoothMapCamera(mapInstance: AMap.Map | null) {
    const zoomOverrideRef = useRef<UserZoomOverride | null>(null);

    const smoothPanTo = useCallback((userLocation: [number, number], defaultZoom = 17, thresholdMeters = 50) => {
        if (!mapInstance || !window.AMap || !window.AMap.GeometryUtil) return;

        const now = Date.now();
        const activeOverride = zoomOverrideRef.current;
        const isOverrideActive = activeOverride && activeOverride.expiresAt > now;

        const targetZoom = isOverrideActive ? activeOverride!.zoom : defaultZoom;

        try {
            const center = mapInstance.getCenter();
            if (!center) {
                mapInstance.setZoomAndCenter(targetZoom, userLocation, false, 800);
                return;
            }

            const dist = window.AMap.GeometryUtil.distance([center.lng, center.lat], userLocation);

            if (dist > thresholdMeters) {
                if (isOverrideActive) {
                    mapInstance.setCenter(userLocation);
                } else {
                    mapInstance.setZoomAndCenter(targetZoom, userLocation, false, 800);
                }
            }
        } catch (e) {
            console.warn("[useSmoothMapCamera] Smooth pan interrupted or failed:", e);
        }
    }, [mapInstance]);

    const onUserZoomChange = useCallback((newZoom: number) => {
        zoomOverrideRef.current = {
            zoom: newZoom,
            expiresAt: Date.now() + 3000,
        };
    }, []);

    return { smoothPanTo, onUserZoomChange };
}
