/// <reference types="@amap/amap-jsapi-types" />
"use client"

import { useEffect, useRef, useState, useMemo } from 'react'
import { safeLoadAMap, safeDestroyMap } from '@/lib/map/safe-amap';
import MapManager from "@/lib/mapManager"
import { type Location } from '@/hooks/useRunningTracker'
import { useTheme } from 'next-themes'
import { useSmoothMapCamera } from '@/hooks/useSmoothMapCamera'
import { useLocationStore } from '@/store/useLocationStore'
import { TrajectoryLayer } from '@/components/map/layers/TrajectoryLayer'

// Security Config
const AMAP_KEY = process.env.NEXT_PUBLIC_AMAP_KEY || "e7c09f023c10603e1fa8877e796965e9"

interface RunningMapProps {
  userLocation?: [number, number]
  path?: Location[]
  startLocation?: [number, number]
  closedPolygons?: Location[][]
  onLocationUpdate?: (lat: number, lng: number) => void
  recenterTrigger?: number
  showKingdom?: boolean // Controls territory polygon visibility
}

export function RunningMap({
  userLocation,
  path = [],
  startLocation,
  closedPolygons = [],
  onLocationUpdate,
  recenterTrigger = 0,
  showKingdom = true,
}: RunningMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<AMap.Map | null>(null)
  const amapRef = useRef<typeof AMap | null>(null)

  // Refs for map elements
  const userMarkerRef = useRef<AMap.Marker | null>(null)
  const polygonRefs = useRef<AMap.Polygon[]>([]) // Store polygon instances
  const kmMarkersRef = useRef<AMap.Marker[]>([])
  const locationCircleRef = useRef<AMap.Circle | null>(null) // Accuracy circle
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null)
  const lastSourceRef = useRef<string | undefined>(undefined)

  const { smoothPanTo, onUserZoomChange } = useSmoothMapCamera(mapInstanceRef.current);
  const globalLocation = useLocationStore(s => s.location);
  const locationSource = useLocationStore(s => s.locationSource);

  // User Color Preferences
  const pathColor = '#3B82F6' // Blue 500

  // Refs for initial center (avoid re-init on every location change)
  const initialCenterRef = useRef(userLocation || startLocation);

  // Update ref when startLocation changes (but don't re-trigger init)
  useEffect(() => {
    if (startLocation) initialCenterRef.current = startLocation;
  }, [startLocation]);

  // Map Interaction State
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const isUserInteractingRef = useRef(false);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestUserLocationRef = useRef(userLocation);

  // Keep track of latest user location for the timeout callback
  useEffect(() => {
    latestUserLocationRef.current = userLocation;
  }, [userLocation]);

  useEffect(() => {
    isUserInteractingRef.current = isUserInteracting;
  }, [isUserInteracting]);

  // 1. Initialize Map (ONCE only — no location dependencies to prevent flickering!)
  useEffect(() => {
    if (!mapContainerRef.current) return

    let destroyed = false;

    const init = async () => {
      try {
        const AMap = await safeLoadAMap({
          plugins: ["AMap.Polyline", "AMap.Marker", "AMap.GeometryUtil", "AMap.Polygon", "AMap.Circle"]
        });

        if (destroyed || !mapContainerRef.current || !AMap) return;

        // Ensure Geolocation plugin is loaded even if safeLoadAMap cached a previous instance without it
        // Use AMap.plugin wrapper
        await new Promise<void>((resolve) => {
          AMap.plugin('AMap.Geolocation', () => resolve());
        });

        // Custom Map Style (Cyberpunk/Dark to match main map)
        const MAP_STYLE = "amap://styles/22e069175d1afe32e9542abefde02cb5";

        // Use ref for initial center to avoid dependency on frequently-changing values
        const center = initialCenterRef.current || [116.397, 39.909];

        const map = new AMap.Map(mapContainerRef.current, {
          zoom: 17,
          center,
          mapStyle: MAP_STYLE,
          skyColor: "#1f2029",
          viewMode: "2D", // 2D mode for performance and cleaner look
          showLabel: false, // Hide labels for cleaner runner view
          
          // ✅ Layer 3 优化：限制瓦片缓存数量，防止 tile memory limits exceeded
          tileSizeCache: 64, // 默认值通常是 256-512，低内存设备建议 64-128
          
          // ✅ 降低地图分辨率倍率，减少 GPU 纹理占用
          // 1 = 标准分辨率; 0.75 = 降低 44% 显存占用，视觉差异几乎不可感知
          devicePixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
          
          // ✅ 关闭不必要的3D楼块渲染（3D瓦片比2D消耗多3倍显存）
          showBuildingBlock: false,
          
          // ✅ 调整最大缩放级别，防止过度细化导致瓦片爆炸
          zooms: [3, 18],  // 默认是 [3, 20]，限制到 18 减少高缩放层级瓦片
        });

        // Ensure map is actually created
        if (!map) {
          throw new Error("Map instance not created");
        }

        mapInstanceRef.current = map
        amapRef.current = AMap
        resizeTimeoutRef.current = setTimeout(() => {
          const mapWithResize = mapInstanceRef.current as (AMap.Map & { resize?: () => void }) | null
          if (mapWithResize && typeof mapWithResize.resize === "function") {
            mapWithResize.resize()
          }
        }, 200)

        // Add User Marker immediately
        if (!userMarkerRef.current) {
          const markerContent = `
                <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
                    <div style="position: absolute; width: 100%; height: 100%; background-color: rgba(34, 197, 94, 0.4); border-radius: 50%; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                    <div style="position: relative; width: 12px; height: 12px; background-color: #22c55e; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(34, 197, 94, 0.6);"></div>
                </div>
                <style>
                    @keyframes ping {
                        75%, 100% { transform: scale(2); opacity: 0; }
                    }
                </style>
             `;

          userMarkerRef.current = new AMap.Marker({
            position: center,
            content: markerContent,
            offset: new AMap.Pixel(-12, -12),
            zIndex: 100,
            visible: !!(userLocation || globalLocation) // Only visible if we have a real user location
          })

          // Check if map.add exists before calling
          if (map && typeof map.add === 'function') {
            map.add(userMarkerRef.current)
          } else {
            console.error("Map instance invalid - missing add method", map);
          }
        }

        // Map Interaction Listeners for Auto-Center Recovery
        const handleInteractionStart = () => {
          setIsUserInteracting(true);
          if (interactionTimeoutRef.current) {
            clearTimeout(interactionTimeoutRef.current);
          }
        };

        const handleInteractionEnd = () => {
          if (interactionTimeoutRef.current) {
            clearTimeout(interactionTimeoutRef.current);
          }
          interactionTimeoutRef.current = setTimeout(() => {
            setIsUserInteracting(false);
            if (latestUserLocationRef.current && mapInstanceRef.current) {
              const map = mapInstanceRef.current as AMap.Map & { flyTo?: (opts: { center: [number, number]; zoom: number; duration: number }) => void };
              if (typeof map.flyTo === 'function') {
                map.flyTo({
                  center: latestUserLocationRef.current,
                  zoom: map.getZoom(),
                  duration: 600
                });
              } else {
                map.panTo(latestUserLocationRef.current);
              }
            }
          }, 3000);
        };

        map.on('dragstart', handleInteractionStart);
        map.on('zoomstart', handleInteractionStart);
        map.on('touchstart', handleInteractionStart);

        map.on('dragend', handleInteractionEnd);
        map.on('zoomend', handleInteractionEnd);
        map.on('touchend', handleInteractionEnd);

        map.on('zoomchange', () => {
          const currentZoom = map.getZoom();
          if (typeof currentZoom === 'number' && onUserZoomChange) {
            onUserZoomChange(currentZoom);
          }
        });

      } catch (e) {
        console.error("Failed to init RunningMap", e)
      }
    }

    init()

    return () => {
      destroyed = true;
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      // Destroy this independent map instance on unmount
      if (mapInstanceRef.current && typeof mapInstanceRef.current.destroy === 'function') {
        mapInstanceRef.current.destroy()
      }
      safeDestroyMap(mapInstanceRef.current);
      mapInstanceRef.current = null;
      if (userMarkerRef.current) userMarkerRef.current = null;
      if (locationCircleRef.current) locationCircleRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Init ONCE only — location updates handled by separate effects

  // Unified activeLocation selecting userLocation if provided, otherwise globalLocation
  const activeLocation = useMemo(() => {
    if (userLocation) {
      return {
        lng: userLocation[0],
        lat: userLocation[1],
        speed: globalLocation?.speed,
        source: locationSource || undefined,
        accuracy: globalLocation?.accuracy,
        heading: globalLocation?.heading,
      };
    }
    return globalLocation;
  }, [userLocation, globalLocation, locationSource]);

  // 2. Update Position — adaptive speed noise gate and smooth moveTo animation
  useEffect(() => {
    if (!mapInstanceRef.current || !userMarkerRef.current || !activeLocation) return;
    const AMap = amapRef.current;
    if (!AMap) return;

    const targetPos = new AMap.LngLat(activeLocation.lng, activeLocation.lat);

    // Adaptive speed noise gate
    const lastPos = lastPosRef.current;
    if (lastPos) {
      const dx = (activeLocation.lat - lastPos.lat) * 111000;
      const dy = (activeLocation.lng - lastPos.lng) * 111000 * Math.cos(activeLocation.lat * Math.PI / 180);
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      const speed = activeLocation.speed ?? 0;
      const noiseGate = speed < 0.5 ? 5.0 : 1.5; // 5.0m threshold if stationary, 1.5m if moving
      if (dist < noiseGate) return; // Ignore small drift
    }
    lastPosRef.current = { lat: activeLocation.lat, lng: activeLocation.lng };

    const currentPos = userMarkerRef.current.getPosition();
    const distance = currentPos ? currentPos.distance(targetPos) : 0;

    userMarkerRef.current.show();

    if (!currentPos || distance > 500) {
      // First load or huge jump -> set position immediately
      userMarkerRef.current.setPosition(targetPos);
    } else if (distance > 0.5) {
      // Smooth transition - stop current animation first
      if (typeof userMarkerRef.current.stopMove === 'function') {
        userMarkerRef.current.stopMove();
      }

      const targetDurationSec = 0.8;
      const animSpeed = Math.max(1, (distance / 1000) / (targetDurationSec / 3600));

      userMarkerRef.current.moveTo(targetPos, {
        duration: 800,
        speed: animSpeed,
        autoRotation: false,
      });
    }

    // Smooth Pan to user using the hook (only if not interacting)
    if (!isUserInteractingRef.current) {
      smoothPanTo([activeLocation.lng, activeLocation.lat]);
    }

    // Accuracy Circle
    const radius = activeLocation.accuracy || 30;
    if (!locationCircleRef.current) {
      locationCircleRef.current = new AMap.Circle({
        center: targetPos,
        radius: radius,
        strokeColor: "#3B82F6",
        strokeOpacity: 0.2,
        strokeWeight: 1,
        fillColor: "#3B82F6",
        fillOpacity: 0.1,
        zIndex: 90
      });
      mapInstanceRef.current.add(locationCircleRef.current);
    } else {
      locationCircleRef.current.setCenter(targetPos);
      locationCircleRef.current.setRadius(radius);
      if (!locationCircleRef.current.getMap()) {
        mapInstanceRef.current.add(locationCircleRef.current);
      }
    }

    if (onLocationUpdate) {
      onLocationUpdate(activeLocation.lat, activeLocation.lng);
    }

  }, [activeLocation, smoothPanTo, onLocationUpdate]);

  // Recenter Trigger Effect
  useEffect(() => {
    if (!mapInstanceRef.current || !userLocation) return
    const map = mapInstanceRef.current as AMap.Map & { flyTo?: (opts: { center: [number, number]; zoom: number; duration: number }) => void };
    setIsUserInteracting(false);
    if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    if (typeof map.flyTo === 'function') {
      map.flyTo({
        center: userLocation,
        zoom: 17,
        duration: 600
      });
    } else {
      map.panTo(userLocation);
      map.setZoom(17);
    }
  }, [recenterTrigger])

  // 3. Render Polygons (Territories)
  useEffect(() => {
    if (!mapInstanceRef.current || !amapRef.current) return
    const map = mapInstanceRef.current
    const AMap = amapRef.current

    // Clear old polygons
    if (polygonRefs.current.length > 0) {
      map.remove(polygonRefs.current);
      polygonRefs.current = [];
    }

    if (closedPolygons && closedPolygons.length > 0 && AMap) {
      closedPolygons.forEach(polyPath => {
        const pathCoords = polyPath.map(p => [p.lng, p.lat] as [number, number]);
        const polygon = new (AMap as any).Polygon({
          path: pathCoords,
          fillColor: '#10B981', // Emerald
          fillOpacity: 0.3,
          strokeColor: '#059669',
          strokeWeight: 2,
          zIndex: 40
        });
        map.add(polygon);
        if (!showKingdom) polygon.hide(); // Apply current visibility immediately on creation
        polygonRefs.current.push(polygon);
      });
    }
  }, [closedPolygons, showKingdom])

  // 5. Toggle polygon visibility when showKingdom changes
  useEffect(() => {
    if (polygonRefs.current.length === 0) return;
    polygonRefs.current.forEach(polygon => {
      if (polygon && typeof polygon.show === 'function' && typeof polygon.hide === 'function') {
        if (showKingdom) {
          polygon.show();
        } else {
          polygon.hide();
        }
      }
    });
  }, [showKingdom])

  // 4. Render KM Markers only (Polyline is handled by TrajectoryLayer)
  useEffect(() => {
    if (!path || path.length < 2) return;
    if (locationSource === 'cache') return;
    if (!mapInstanceRef.current || !amapRef.current) return
    const map = mapInstanceRef.current
    const AMap = amapRef.current

    const pathCoords = path
      .filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map(p => [p.lng, p.lat] as [number, number])

    if (pathCoords.length < 2) return

    let totalDist = 0
    let nextKmTarget = 1000

    map.remove(kmMarkersRef.current)
    kmMarkersRef.current = []

    for (let i = 0; i < pathCoords.length - 1; i++) {
      const p1 = pathCoords[i]
      const p2 = pathCoords[i + 1]
      const d = AMap.GeometryUtil.distance(p1, p2)

      if (totalDist + d >= nextKmTarget) {
        const kmLabel = nextKmTarget / 1000

        const markerContent = `
                <div style="
                    background-color: white; 
                    color: #3B82F6; 
                    font-size: 10px; 
                    font-weight: bold; 
                    padding: 2px 6px; 
                    border-radius: 8px; 
                    border: 1px solid #3B82F6;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                ">${kmLabel}</div>
            `

        const marker = new AMap.Marker({
          position: p2,
          content: markerContent,
          offset: new AMap.Pixel(-10, -10),
          zIndex: 60
        })

        kmMarkersRef.current.push(marker)
        nextKmTarget += 1000
      }

      totalDist += d
    }

    if (kmMarkersRef.current.length > 0) {
      if (map && typeof map.add === 'function') {
        map.add(kmMarkersRef.current)
      }
    }

  }, [path, locationSource])

  return (
    <div className="w-full h-full relative bg-slate-900">
      <div ref={mapContainerRef} className="w-full h-full absolute inset-0 z-0" />
      {/* Optional: Add gradient overlay if needed, but Smart Planner usually has clean map */}
      <TrajectoryLayer map={mapInstanceRef.current} path={path} strokeColor="#3B82F6" strokeWeight={6} />
    </div>
  )
}
