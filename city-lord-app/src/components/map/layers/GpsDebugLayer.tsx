import { useEffect, useRef } from 'react';
import { useGpsDebugStore } from '@/store/useGpsDebugStore';
import { useMap } from '@/components/map/AMapContext';

export function GpsDebugLayer() {
  const { map } = useMap();
  const isGpsDebugMode = useGpsDebugStore(s => s.isGpsDebugMode);
  const debugGpsTrace = useGpsDebugStore(s => s.debugGpsTrace);
  const layerRef = useRef<any[]>([]);

  useEffect(() => {
    if (!isGpsDebugMode || !map || !window.AMap) {
      if (layerRef.current.length > 0 && map) {
        map.remove(layerRef.current);
        layerRef.current = [];
      }
      return;
    }

    // High performance incremental rendering
    const currentCount = layerRef.current.length;
    const newPoints = debugGpsTrace.slice(currentCount);

    if (newPoints.length === 0) return;

    const newMarkers = newPoints.map((point) => {
      const isDiscarded = point.status === 'discarded';
      const marker = new window.AMap.CircleMarker({
        center: [point.lng, point.lat],
        radius: isDiscarded ? 5 : 3,
        strokeColor: isDiscarded ? '#ef4444' : '#10b981', // red vs green
        strokeWeight: 2,
        strokeOpacity: 0.8,
        fillColor: isDiscarded ? '#ef4444' : '#10b981',
        fillOpacity: isDiscarded ? 0.4 : 0.8,
        zIndex: 9999,
        bubble: true, // Allow events to bubble up so map drag is not interrupted
      });

      if (isDiscarded) {
        marker.on('click', () => {
          const infoWindow = new window.AMap.InfoWindow({
            content: `<div style="padding: 4px; font-size: 12px; font-weight: bold; color: #ef4444;">Drop: ${point.reason || 'Unknown'}</div>`,
            offset: new window.AMap.Pixel(0, -10)
          });
          infoWindow.open(map, [point.lng, point.lat]);
        });
      }

      return marker;
    });

    map.add(newMarkers);
    layerRef.current = [...layerRef.current, ...newMarkers];

  }, [debugGpsTrace, isGpsDebugMode, map]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (layerRef.current.length > 0 && map) {
        map.remove(layerRef.current);
        layerRef.current = [];
      }
    };
  }, [map]);

  return null;
}
