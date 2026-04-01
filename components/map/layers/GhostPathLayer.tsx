/// <reference types="@amap/amap-jsapi-types" />
import { useEffect, useRef } from 'react';

interface GhostPathLayerProps {
  map: AMap.Map | null;
  ghostPath: [number, number][];
  strokeColor?: string;
  strokeWeight?: number;
}

export function GhostPathLayer({
  map,
  ghostPath,
  strokeColor = '#22C55E',
  strokeWeight = 7,
}: GhostPathLayerProps) {
  const polylineRef = useRef<AMap.Polyline | null>(null);

  useEffect(() => {
    if (!map || !window.AMap) return;

    if (!ghostPath || ghostPath.length < 2) {
      if (polylineRef.current) {
        map.remove?.(polylineRef.current);
        polylineRef.current = null;
      }
      return;
    }

    const mapInstance = map;
    const amapPath = ghostPath
      .map(([lat, lng]) => [lng, lat] as [number, number])
      .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));

    if (amapPath.length < 2) {
      if (polylineRef.current) {
        mapInstance.remove?.(polylineRef.current);
        polylineRef.current = null;
      }
      return;
    }

    if (!polylineRef.current) {
      polylineRef.current = new window.AMap.Polyline({
        path: amapPath,
        strokeColor,
        strokeWeight,
        strokeOpacity: 0.95,
        strokeStyle: 'dashed',
        zIndex: 58,
        lineJoin: 'round',
        lineCap: 'round',
      });
      mapInstance.add?.(polylineRef.current);
    } else {
      polylineRef.current.setPath(amapPath);
    }

    return () => {
      if (polylineRef.current) {
        mapInstance.remove?.(polylineRef.current);
        polylineRef.current = null;
      }
    };
  }, [map, ghostPath, strokeColor, strokeWeight]);

  return null;
}
