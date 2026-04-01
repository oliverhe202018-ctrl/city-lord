/// <reference types="@amap/amap-jsapi-types" />
import { memo, useEffect, useMemo, useRef } from 'react';

interface GhostPathLayerProps {
  map: AMap.Map | null;
  ghostPath: [number, number][];
  strokeColor?: string;
  strokeWeight?: number;
}

function GhostPathLayerComponent({
  map,
  ghostPath,
  strokeColor = '#22C55E',
  strokeWeight = 7,
}: GhostPathLayerProps) {
  const polylineRef = useRef<AMap.Polyline | null>(null);

  useEffect(() => {
    if (!map || !window.AMap) return;
    const polyline = new window.AMap.Polyline({
      path: [],
      strokeColor,
      strokeWeight,
      strokeOpacity: 0.95,
      strokeStyle: 'dashed',
      zIndex: 58,
      lineJoin: 'round',
      lineCap: 'round',
    });
    polylineRef.current = polyline;
    map.add?.(polyline);
    return () => {
      map.remove?.(polyline);
      if (polylineRef.current === polyline) {
        polylineRef.current = null;
      }
    };
  }, [map]);

  const amapPath = useMemo(
    () =>
      ghostPath
        .map(([lat, lng]) => [lng, lat] as [number, number])
        .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat)),
    [ghostPath]
  );

  useEffect(() => {
    const polyline = polylineRef.current;
    if (!polyline) return;
    polyline.setOptions({
        strokeColor,
        strokeWeight,
    });
    if (amapPath.length < 2) {
      polyline.setPath([]);
      return;
    }
    polyline.setPath(amapPath);
  }, [amapPath, strokeColor, strokeWeight]);

  return null;
}

export const GhostPathLayer = memo(GhostPathLayerComponent);
GhostPathLayer.displayName = 'GhostPathLayer';
