"use client";

import { useEffect, useRef } from "react";
import { useMap } from "./AMapContext";
import gcoord from "gcoord";

interface SelfLocationMarkerProps {
  position: {
    latitude: number;
    longitude: number;
    coordType?: 'gcj02';
  } | null;
}

export function SelfLocationMarker({ position }: SelfLocationMarkerProps) {
  const { map } = useMap();
  const markerRef = useRef<any>(null);

  // 1. Initialize Marker when map is ready
  useEffect(() => {
    if (!map || !window.AMap) return;

    // Clean up existing marker if any
    if (markerRef.current) {
      map.remove(markerRef.current);
      markerRef.current = null;
    }

    // Create a new marker
    const markerContent = `
      <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background-color: rgba(74, 222, 128, 0.5); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: relative; width: 12px; height: 12px; border-radius: 50%; background-color: #22c55e; border: 2px solid white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);"></div>
      </div>
    `;

    markerRef.current = new window.AMap.Marker({
      content: markerContent,
      offset: new window.AMap.Pixel(-12, -12),
      zIndex: 200,
      anchor: 'center',
    });

    if (map && typeof map.add === 'function') {
        map.add(markerRef.current);
    } else {
        console.warn("SelfLocationMarker: Map instance invalid, skipping add");
    }

    // Initial position set if available
    if (position) {
      let pos = [position.longitude, position.latitude];
      if (position.coordType !== 'gcj02') {
         pos = gcoord.transform(pos, gcoord.WGS84, gcoord.GCJ02);
      }
      markerRef.current.setPosition(pos);
    }

    return () => {
      if (markerRef.current) {
        try {
            if (typeof map.remove === 'function') {
                map.remove(markerRef.current);
            } else if (typeof markerRef.current.setMap === 'function') {
                markerRef.current.setMap(null);
            }
        } catch (e) {
            console.warn('Failed to remove marker', e);
        }
        markerRef.current = null;
      }
    };
  }, [map]);

  // 2. Update marker position when position changes (Race Condition Fix)
  useEffect(() => {
    if (map && markerRef.current && position) {
      let newPos = [position.longitude, position.latitude];
      if (position.coordType !== 'gcj02') {
         newPos = gcoord.transform(newPos, gcoord.WGS84, gcoord.GCJ02);
      }
      markerRef.current.setPosition(newPos);
    }
  }, [map, position]);

  return null;
}
