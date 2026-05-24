"use client";

import { useEffect, useRef } from 'react';
import { GeoPoint } from '@/hooks/useSafeGeolocation';

interface UserMarkerLayerProps {
  map: any | null;
  position: GeoPoint | null;
  isTracking?: boolean;
  instantSync?: boolean;
  accuracy?: number;
  signalStrength?: 'good' | 'weak' | 'none';
}

/**
 * UserMarkerLayer: Blue dot marker for user's current location
 * 
 * Renders smooth-animated blue dot that represents user GPS position.
 * Separate from TrajectoryLayer (which shows the path).
 */
export function UserMarkerLayer({ map, position, isTracking, instantSync = false, accuracy, signalStrength = 'none' }: UserMarkerLayerProps) {
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
          .user-marker-dot.signal-none {
            background: #EF4444;
            animation: shake 0.5s ease-in-out infinite;
          }
          .user-marker-dot.signal-weak {
            background: #F59E0B;
            animation: pulse-slow 3s ease-in-out infinite;
          }
          .user-marker-dot.signal-good {
            background: #3B82F6;
            animation: pulse 2s ease-in-out infinite;
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
          .user-marker-pulse.signal-none {
            background: rgba(239, 68, 68, 0.3);
            animation: pulse-red 2s infinite;
          }
          .user-marker-pulse.signal-weak {
            background: rgba(245, 158, 11, 0.3);
            animation: pulse-orange 2s infinite;
          }
          .user-marker-pulse.signal-good {
            background: rgba(59, 130, 246, 0.3);
            animation: pulse 2s infinite;
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
          @keyframes pulse-red {
            0% {
              transform: translate(-50%, -50%) scale(1);
              opacity: 0.4;
            }
            100% {
              transform: translate(-50%, -50%) scale(2.5);
              opacity: 0;
            }
          }
          @keyframes pulse-orange {
            0% {
              transform: translate(-50%, -50%) scale(1);
              opacity: 0.5;
            }
            100% {
              transform: translate(-50%, -50%) scale(2.5);
              opacity: 0;
            }
          }
          @keyframes pulse-slow {
            0%, 100% {
              transform: translate(-50%, -50%) scale(1);
            }
            50% {
              transform: translate(-50%, -50%) scale(1.1);
            }
          }
          @keyframes shake {
            0%, 100% {
              transform: translate(-50%, -50%) translateX(0);
            }
            25% {
              transform: translate(-50%, -50%) translateX(-1px);
            }
            75% {
              transform: translate(-50%, -50%) translateX(1px);
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
    
    // Guard against invalid/undefined coordinates in initialPosition
    const isValidPos = position && typeof position.lng === 'number' && typeof position.lat === 'number' && !isNaN(position.lng) && !isNaN(position.lat);
    const isValidCenter = center && typeof center.lng === 'number' && typeof center.lat === 'number' && !isNaN(center.lng) && !isNaN(center.lat);
    
    const initialPosition = isValidPos
      ? new AMap.LngLat(position.lng, position.lat)
      : isValidCenter
        ? new AMap.LngLat(center.lng, center.lat)
        : new AMap.LngLat(116.397428, 39.90923); // Default to Beijing if unavailable

    const el = document.createElement('div');
    el.className = 'user-location-marker';
    el.innerHTML = `
      <div class="user-marker-container">
        <div class="user-marker-dot signal-${signalStrength}"></div>
        <div class="user-marker-pulse signal-${signalStrength}"></div>
      </div>
    `;
    markerRef.current = new AMap.Marker({
      position: initialPosition,
      content: el,
      zIndex: 100,
      anchor: 'center'
    });
    map.add(markerRef.current);

    return () => {
      if (map && markerRef.current) {
        try {
          map?.remove?.(markerRef.current);
          markerRef.current.destroy?.();
        } catch (e) {
          console.warn('[UserMarkerLayer] Cleanup error:', e);
        }
        markerRef.current = null;
      }
    };
  }, [map]);

  useEffect(() => {
    if (!markerRef.current || !position || !window.AMap) return;
    
    // Guard against invalid/undefined coordinates on updates
    if (typeof position.lng !== 'number' || typeof position.lat !== 'number' || isNaN(position.lng) || isNaN(position.lat)) {
      return;
    }
    
    const newPos = new window.AMap.LngLat(position.lng, position.lat);
    
    if (instantSync) {
      markerRef.current.setPosition(newPos);
      return;
    }
    if (markerRef.current.moveTo) {
      markerRef.current.moveTo(newPos, {
        duration: 800,
        delay: 0
      });
      return;
    }
    markerRef.current.setPosition(newPos);
  }, [instantSync, position]);

  // 监听信号强度变化，更新标记样式
  useEffect(() => {
    if (!markerRef.current) return;
    
    // 获取当前标记的 DOM 元素
    const markerEl = markerRef.current.getContent?.();
    if (!markerEl) return;
    
    // 更新信号强度样式类
    const dotEl = markerEl.querySelector?.('.user-marker-dot');
    const pulseEl = markerEl.querySelector?.('.user-marker-pulse');
    
    if (dotEl) {
      dotEl.className = 'user-marker-dot';
      dotEl.classList.add(`signal-${signalStrength}`);
    }
    if (pulseEl) {
      pulseEl.className = 'user-marker-pulse';
      pulseEl.classList.add(`signal-${signalStrength}`);
    }
  }, [signalStrength]);

  return null;
}
