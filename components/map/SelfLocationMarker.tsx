"use client";

import { useEffect, useRef } from "react";
import { useMap } from "./AMapContext";
import { GeoPoint } from "@/hooks/useSafeGeolocation";

interface SelfLocationMarkerProps {
  position: GeoPoint | null;
}

export function SelfLocationMarker({ position }: SelfLocationMarkerProps) {
  const { map } = useMap();
  const markerRef = useRef<any>(null);
  const isMovingRef = useRef(false);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastSourceRef = useRef<string | undefined>(undefined);

  // Build marker DOM content — memoized to avoid unnecessary rebuilds
  const buildMarkerContent = (isCached: boolean, heading?: number) => {
    const mainColor = isCached ? '#9ca3af' : '#3b82f6';
    const pulseColor = isCached ? 'rgba(156, 163, 175, 0.5)' : 'rgba(59, 130, 246, 0.5)';
    const headingTransform = (heading !== null && heading !== undefined)
      ? `transform: rotate(${heading}deg);`
      : '';
    return `
      <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background-color: ${pulseColor}; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: relative; width: 12px; height: 12px; border-radius: 50%; background-color: ${mainColor}; border: 2px solid white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);"></div>
        <div style="position: absolute; top: -8px; width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-bottom: 6px solid ${mainColor}; ${headingTransform}"></div>
      </div>
    `;
  };

  // 1. Initialize Marker when map is ready
  useEffect(() => {
    if (!map || !window.AMap || markerRef.current) return;

    const markerContent = buildMarkerContent(position?.source === 'cache', position?.heading ?? undefined);

    markerRef.current = new window.AMap.Marker({
      content: markerContent,
      offset: new window.AMap.Pixel(-12, -12),
      zIndex: 200,
      anchor: 'center',
      bubble: true,
    });
    map.add(markerRef.current);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // 2. Update Position — only setContent on source change, moveTo with 1m cache guard
  useEffect(() => {
    if (!map || !markerRef.current || !position) return;

    // Fix 2b: 仅当 position.source 变化时才重建 DOM 内容
    if (position.source !== lastSourceRef.current) {
      const markerContent = buildMarkerContent(position.source === 'cache', position.heading ?? undefined);
      markerRef.current.setContent(markerContent);
      lastSourceRef.current = position.source;
    }

    // Transform WGS84 to GCJ02 (hook already does this)
    const targetPos = new window.AMap.LngLat(position.lng, position.lat);

    // Fix 2c: 1 米位置缓存守卫 — 静态 GPS 噪声不触发动画
    const lastPos = lastPosRef.current;
    if (lastPos) {
      const dx = (position.lat - lastPos.lat) * 111000;
      const dy = (position.lng - lastPos.lng) * 111000 * Math.cos(position.lat * Math.PI / 180);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) return; // 位移不足 1 米，忽略
    }
    lastPosRef.current = { lat: position.lat, lng: position.lng };

    const currentPos = markerRef.current.getPosition();
    const distance = currentPos ? currentPos.distance(targetPos) : 0;

    if (!currentPos || distance > 500) {
      // 首次加载或大幅跳跃 → 直接设置
      markerRef.current.setPosition(targetPos);
    } else if (distance > 0.5) {
      // 平滑移动 — 先停止在进行的动画，防止队列堆积
      if (typeof markerRef.current.stopMove === 'function') {
        markerRef.current.stopMove();
      }

      const targetDurationSec = 0.8;
      const speed = Math.max(1, (distance / 1000) / (targetDurationSec / 3600));

      markerRef.current.moveTo(targetPos, {
        duration: 800,
        speed: speed,
        autoRotation: false,
      });
    }

  }, [map, position]);

  return null;
}
