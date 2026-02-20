/// <reference types="@amap/amap-jsapi-types" />
import { useCallback } from 'react';

export function useSmoothMapCamera(mapInstance: AMap.Map | null) {
    const smoothPanTo = useCallback((userLocation: [number, number], zoom = 17, thresholdMeters = 50) => {
        // Safety checks before calling AMAP API
        if (!mapInstance || !window.AMap || !window.AMap.GeometryUtil) return;

        try {
            const center = mapInstance.getCenter();
            if (!center) {
                // Fallback to direct set if no center is available
                mapInstance.setZoomAndCenter(zoom, userLocation, false, 800);
                return;
            }

            const dist = window.AMap.GeometryUtil.distance([center.lng, center.lat], userLocation);

            // Filter micro drifts
            if (dist > thresholdMeters) {
                mapInstance.setZoomAndCenter(zoom, userLocation, false, 800);
            }
        } catch (e) {
            console.warn("[useSmoothMapCamera] Smooth pan interrupted or failed:", e);
        }
    }, [mapInstance]);

    return { smoothPanTo };
}
