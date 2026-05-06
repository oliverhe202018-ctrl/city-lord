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

    // Create marker content based on source
    const isCached = position?.source === 'cache';
    const mainColor = isCached ? '#9ca3af' : '#3b82f6'; // Gray-400 vs Blue-500
    const pulseColor = isCached ? 'rgba(156, 163, 175, 0.5)' : 'rgba(59, 130, 246, 0.5)';

    const markerContent = `
      <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background-color: ${pulseColor}; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: relative; width: 12px; height: 12px; border-radius: 50%; background-color: ${mainColor}; border: 2px solid white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);"></div>
        <!-- Heading Indicator (Triangle) -->
        <div id="heading-arrow" style="position: absolute; top: -8px; width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-bottom: 6px solid ${mainColor}; display: none;"></div>
      </div>
    `;

    if (markerRef.current) {
      markerRef.current.setContent(markerContent);
    } else {
      markerRef.current = new window.AMap.Marker({
        content: markerContent,
        offset: new window.AMap.Pixel(-12, -12),
        zIndex: 200, // Higher than normal markers
        anchor: 'center',
        bubble: true, // Allow click events to pass through
      });
      map.add(markerRef.current);
    }

    return () => {
      if (markerRef.current) {
        try {
          map?.remove?.(markerRef.current);
        } catch (e) {
          console.warn('[SelfLocationMarker] Cleanup error:', e);
        }
        markerRef.current = null;
      }
    };
  }, [map]);

  // 2. Update Position and Style
  useEffect(() => {
    if (!map || !markerRef.current || !position) return;

    // Update Marker Content (Color) based on source
    const isCached = position.source === 'cache';
    const mainColor = isCached ? '#9ca3af' : '#3b82f6'; // Gray-400 vs Blue-500
    const pulseColor = isCached ? 'rgba(156, 163, 175, 0.5)' : 'rgba(59, 130, 246, 0.5)';

    const markerContent = `
      <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background-color: ${pulseColor}; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: relative; width: 12px; height: 12px; border-radius: 50%; background-color: ${mainColor}; border: 2px solid white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);"></div>
        <!-- Heading Indicator (Triangle) -->
        <div id="heading-arrow" style="position: absolute; top: -8px; width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-bottom: 6px solid ${mainColor}; display: none;"></div>
      </div>
    `;

    // Only update content if changed? AMap setContent is likely optimized, but we can check if source changed if we tracked it.
    // For now, just set it. It's string replacement.
    markerRef.current.setContent(markerContent);

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
    } else if (distance > 0.5) {
      // Smooth Move — stop any in-progress animation first to prevent queue buildup
      if (typeof markerRef.current.stopMove === 'function') {
        markerRef.current.stopMove();
      }

      // Duration = 800ms matches GPS update interval (~1s) from Kalman filter.
      // Speed is calculated to complete the move within the target duration.
      // AMap JS API v2 moveTo accepts speed in km/h.
      const targetDurationSec = 0.8;
      const speed = Math.max(1, (distance / 1000) / (targetDurationSec / 3600)); // km/h

      markerRef.current.moveTo(targetPos, {
        duration: 800,
        speed: speed,
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
