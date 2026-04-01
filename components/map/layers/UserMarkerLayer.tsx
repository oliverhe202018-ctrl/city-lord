"use client";

import { useEffect, useRef } from 'react';
import { GeoPoint } from '@/hooks/useSafeGeolocation';

interface UserMarkerLayerProps {
  map: any | null;
  position: GeoPoint | null;
  isTracking?: boolean;
}

/**
 * UserMarkerLayer: Blue dot marker for user's current location
 * 
 * Renders smooth-animated blue dot that represents user GPS position.
 * Separate from TrajectoryLayer (which shows the path).
 */
export function UserMarkerLayer({ map, position, isTracking }: UserMarkerLayerProps) {
  const markerRef = useRef<any>(null);
  const styleInjectedRef = useRef(false);

  useEffect(() => {
    if (!map || !window.AMap) return;
    if (!styleInjectedRef.current) {
      const existingStyle = document.getElementById('user-marker-style');
      if (!existingStyle) {
        const style = document.createElement('style');
        style.id = 'user-marker-style';
        style.textContent = `
          .user-marker-container {
            position: relative;
            width: 20px;
            height: 20px;
            transition: transform 0.3s ease-out;
            pointer-events: none;
          }
          .user-marker-dot {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 14px;
            height: 14px;
            background: #3B82F6;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            transition: transform 0.3s ease;
            z-index: 2;
          }
          .user-marker-pulse {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 20px;
            height: 20px;
            background: rgba(59, 130, 246, 0.3);
            border-radius: 50%;
            animation: pulse 2s infinite;
            z-index: 1;
          }
          @keyframes pulse {
            0% {
              transform: translate(-50%, -50%) scale(1);
              opacity: 0.6;
            }
            100% {
              transform: translate(-50%, -50%) scale(2.5);
              opacity: 0;
            }
          }
        `;
        document.head.appendChild(style);
      }
      styleInjectedRef.current = true;
    }
    if (markerRef.current) return;
    const AMap = window.AMap;
    const center = map.getCenter?.();
    const initialPosition = position
      ? [position.lng, position.lat]
      : center
        ? [center.lng, center.lat]
        : [0, 0];
    const el = document.createElement('div');
    el.className = 'user-location-marker';
    el.innerHTML = `
      <div class="user-marker-container">
        <div class="user-marker-dot"></div>
        <div class="user-marker-pulse"></div>
      </div>
    `;
    markerRef.current = new AMap.Marker({
// @ts-expect-error - Baseline exemption for pre-existing schema mismatch - [Ticket-202603-SchemaSync] baseline exemption
      position: initialPosition,
      content: el,
      offset: new AMap.Pixel(-10, -10),
      zIndex: 100,
      anchor: 'center'
    });
    map.add(markerRef.current);

    return () => {
      if (map && markerRef.current) {
        try {
          map?.remove?.(markerRef.current);
        } catch (e) {
          console.warn('[UserMarkerLayer] Cleanup error:', e);
        }
        markerRef.current = null;
      }
    };
  }, [map]);

  useEffect(() => {
    if (!markerRef.current || !position) return;
    const newPos: [number, number] = [position.lng, position.lat];
    if (markerRef.current.moveTo) {
      markerRef.current.moveTo(newPos, {
        duration: 800,
        delay: 0
      });
      return;
    }
    markerRef.current.setPosition(newPos);
  }, [position]);

  return null;
}
