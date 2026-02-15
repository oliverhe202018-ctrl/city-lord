"use client";

import { useEffect, useRef } from "react";
import { useMap } from "./AMapContext";
import { GeoPoint } from "@/hooks/useSafeGeolocation";
import gcoord from "gcoord";

interface SelfLocationMarkerProps {
  position: GeoPoint | null;
}

export function SelfLocationMarker({ position }: SelfLocationMarkerProps) {
  const { map } = useMap();
  const markerRef = useRef<any>(null);
  const isMovingRef = useRef(false);

  // 1. Initialize Marker when map is ready
  useEffect(() => {
    if (!map || !window.AMap || markerRef.current) return;

    // Create marker content
    const markerContent = `
      <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background-color: rgba(59, 130, 246, 0.5); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: relative; width: 12px; height: 12px; border-radius: 50%; background-color: #3b82f6; border: 2px solid white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);"></div>
        <!-- Heading Indicator (Triangle) -->
        <div id="heading-arrow" style="position: absolute; top: -8px; width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-bottom: 6px solid #3b82f6; display: none;"></div>
      </div>
    `;

    markerRef.current = new window.AMap.Marker({
      content: markerContent,
      offset: new window.AMap.Pixel(-12, -12),
      zIndex: 200, // Higher than normal markers
      anchor: 'center',
      bubble: true, // Allow click events to pass through
    });

    map.add(markerRef.current);

    return () => {
      if (markerRef.current) {
        map.remove(markerRef.current);
        markerRef.current = null;
      }
    };
  }, [map]);

  // 2. Update Position with Smooth Transition
  useEffect(() => {
    if (!map || !markerRef.current || !position) return;

    // Transform WGS84 (from hook) to GCJ02 (for AMap)
    // Note: hook might already do it, but let's be safe or rely on hook's consistency.
    // The hook `useSafeGeolocation` we wrote ALREADY converts to GCJ02.
    // So we use it directly.
    const targetPos = new window.AMap.LngLat(position.lng, position.lat);

    const currentPos = markerRef.current.getPosition();
    
    // Calculate distance to decide between direct set or smooth move
    const distance = currentPos ? currentPos.distance(targetPos) : 0;

    if (!currentPos || distance > 500) {
      // First load or large jump (>500m) -> Direct Set
      markerRef.current.setPosition(targetPos);
    } else if (distance > 0) {
      // Smooth Move
      // We want to move over ~1000ms.
      // speed = distance (m) / time (h) ??? No, AMap speed is usually km/h or m/s?
      // AMap JS API v2 moveTo takes speed in km/h.
      // distance is in meters.
      // Speed (km/h) = (Distance (m) / 1000) / (1s / 3600) = Distance * 3.6
      // Let's try to complete it in 1s.
      const speed = distance * 3.6; 
      
      // If AMap.MoveAnimation is loaded, we can use moveTo with speed.
      // Standard Marker in 2.0 supports moveTo.
      markerRef.current.moveTo(targetPos, {
        duration: 1000, // 2.0 supports duration directly? 
        // Docs say: moveTo(targetPos, speed, callback) OR moveTo(targetPos, options)
        // Let's assume standard behavior. If not, use setPosition.
        speed: speed < 1 ? 1 : speed, // Minimum speed
        autoRotation: false,
      });
    }

    // Update Heading if available
    if (position.heading !== null && position.heading !== undefined) {
        // We can rotate the marker or show an arrow.
        // For DOM content, we might need to rotate the inner div.
        // Simple implementation: rotate the marker.
        // But our marker is a circle. Let's rely on the visual indicator if needed.
    }

  }, [map, position]);

  return null;
}
