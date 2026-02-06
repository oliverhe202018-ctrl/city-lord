"use client";

import React, { useEffect, useRef } from "react";
import AMapLoader from "@amap/amap-jsapi-loader";

interface StaticTrajectoryMapProps {
  path: { lat: number; lng: number }[];
  className?: string;
}

export function StaticTrajectoryMap({ path, className }: StaticTrajectoryMapProps) {
  const mapDomRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any | null>(null);

  useEffect(() => {
    // Force security config again before load
    if (typeof window !== "undefined") {
        (window as any)._AMapSecurityConfig = { 
            securityJsCode: 'e827ba611fad4802c48dd900d01eb4bf',
        };
    }

    const key = process.env.NEXT_PUBLIC_AMAP_KEY;
    if (!key) return;

    const securityCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE;
    if (securityCode && typeof window !== "undefined") {
      // @ts-ignore
      window._AMapSecurityConfig = { securityJsCode: securityCode };
    }

    let destroyed = false;

    AMapLoader.load({
      key,
      version: "2.0",
      plugins: [],
    }).then((AMap) => {
        if (destroyed || !mapDomRef.current) return;

        // Initialize map in static mode
        mapRef.current = new AMap.Map(mapDomRef.current, {
          zoom: 13,
          viewMode: "2D",
          mapStyle: "amap://styles/dark",
          features: ['bg', 'road', 'point', 'building'],
          showLabel: false,
          dragEnable: false,
          zoomEnable: false,
          doubleClickZoom: false,
          keyboardEnable: false,
          scrollWheel: false,
          touchZoom: false,
          rotateEnable: false,
        });

        // Convert path to AMap path
        const linePath = path.map(p => [p.lng, p.lat]);

        // Draw Polyline
        if (linePath.length > 0) {
            const polyline = new AMap.Polyline({
                path: linePath,
                isOutline: true,
                outlineColor: '#000',
                borderWeight: 1,
                strokeColor: "#22c55e", 
                strokeOpacity: 1,
                strokeWeight: 6,
                strokeStyle: "solid",
                lineJoin: 'round',
                lineCap: 'round',
                zIndex: 50,
            });
            mapRef.current.add(polyline);

            // Fit bounds to show the whole path
            mapRef.current.setFitView([polyline], true, [20, 20, 20, 20]);
        }

      }).catch((e) => {
        console.error("AMap load error:", e);
      });

    return () => {
      destroyed = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, [path]);

  return <div ref={mapDomRef} className={className} />;
}
