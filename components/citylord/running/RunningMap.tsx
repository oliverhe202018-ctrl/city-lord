/// <reference types="@amap/amap-jsapi-types" />
"use client"

import { useEffect, useRef, useState } from "react"
import { safeLoadAMap, safeDestroyMap } from '@/lib/map/safe-amap';
import MapManager from "@/lib/mapManager"
import { Location } from "@/hooks/useRunningTracker"
import { useTheme } from "next-themes"
import { useSmoothMapCamera } from "@/hooks/useSmoothMapCamera"
import { useLocationStore } from "@/store/useLocationStore"

// Security Config
const AMAP_KEY = process.env.NEXT_PUBLIC_AMAP_KEY || "2f65c697074e0d4c8270195561578e06"

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
  const polylineRef = useRef<AMap.Polyline | null>(null)
  const polygonRefs = useRef<AMap.Polygon[]>([]) // Store polygon instances
  const kmMarkersRef = useRef<AMap.Marker[]>([])
  const locationCircleRef = useRef<AMap.Circle | null>(null) // Accuracy circle

  const { smoothPanTo } = useSmoothMapCamera(mapInstanceRef.current)
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
        });

        // Ensure map is actually created
        if (!map) {
          throw new Error("Map instance not created");
        }

        mapInstanceRef.current = map
        amapRef.current = AMap

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

      } catch (e) {
        console.error("Failed to init RunningMap", e)
      }
    }

    init()

    return () => {
      destroyed = true;
      // Destroy this independent map instance on unmount
      if (mapInstanceRef.current && typeof mapInstanceRef.current.destroy === 'function') {
        mapInstanceRef.current.destroy()
      }
      safeDestroyMap(mapInstanceRef.current);
      mapInstanceRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Init ONCE only — location updates handled by separate effects

  // 1.5 Handle global store location updates if userLocation prop is missing
  useEffect(() => {
    if (!userLocation && globalLocation && mapInstanceRef.current && userMarkerRef.current) {
      const pos = [globalLocation.lng, globalLocation.lat] as [number, number];
      mapInstanceRef.current.setCenter(pos);
      userMarkerRef.current.setPosition(pos);
      userMarkerRef.current.show();
      if (onLocationUpdate) {
        onLocationUpdate(globalLocation.lat, globalLocation.lng);
      }
    }
  }, [globalLocation, userLocation, onLocationUpdate]);

  // 2. Update User Location & Center
  useEffect(() => {
    if (!mapInstanceRef.current || !userMarkerRef.current || !userLocation) return
    const AMap = amapRef.current;

    // Update marker
    userMarkerRef.current.setPosition(userLocation)
    userMarkerRef.current.show()

    // Smooth Pan to user using the new hook
    smoothPanTo(userLocation)

    // Accuracy Circle
    // Assuming 50m default if accuracy not passed, or we should pass accuracy from parent
    // For now, draw a small circle to indicate "range"
    if (!locationCircleRef.current && AMap) {
      locationCircleRef.current = new AMap.Circle({
        center: userLocation,
        radius: 30, // Default 30m range? Or use real accuracy if passed
        strokeColor: "#3B82F6",
        strokeOpacity: 0.2,
        strokeWeight: 1,
        fillColor: "#3B82F6",
        fillOpacity: 0.1,
        zIndex: 90
      })

      // 确保 mapInstanceRef.current 有效再添加
      if (mapInstanceRef.current && typeof mapInstanceRef.current.add === 'function') {
        mapInstanceRef.current.add(locationCircleRef.current);
      }
    } else if (locationCircleRef.current) {
      locationCircleRef.current.setCenter(userLocation)
      // 如果之前没有添加到地图（比如初始化时失败），这里再试一次
      if (!locationCircleRef.current.getMap() && mapInstanceRef.current) {
        mapInstanceRef.current.add(locationCircleRef.current);
      }
    }

  }, [userLocation])

  // Recenter Trigger Effect
  useEffect(() => {
    if (!mapInstanceRef.current || !userLocation) return
    mapInstanceRef.current.panTo(userLocation)
    mapInstanceRef.current.setZoom(17) // Reset zoom too
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
        polygonRefs.current.push(polygon);
      });
    }
  }, [closedPolygons])

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

  // 4. Render Path & KM Markers
  useEffect(() => {
    if (!path || path.length === 0) return;
    // Guard: Only draw polyline from real GPS/native points, not cache
    if (locationSource === 'cache') return;
    if (!mapInstanceRef.current || !amapRef.current || path.length < 2) return
    const map = mapInstanceRef.current
    const AMap = amapRef.current

    // --- Draw Polygons (Territories) ---
    // Moved to separate effect to prevent flickering if path updates fast but polygons don't
    if (polygonRefs.current.length > 0) {
      // Optimization: if polygon count hasn't changed, don't redraw?
      // But closedPolygons prop changes only when new one added.
      // For simplicity, we cleared them in previous effect, but I moved it here?
      // Wait, I messed up the SearchReplace. The previous effect (3) was correct but I replaced it with (4).
      // I need to RESTORE the polygon drawing logic.
    }

    const pathCoords = path.map(p => [p.lng, p.lat] as [number, number])

    if (!polylineRef.current) {
      polylineRef.current = new AMap.Polyline({
        path: pathCoords,
        strokeColor: pathColor,
        strokeWeight: 6,
        strokeOpacity: 0.8,
        zIndex: 50,
        lineJoin: 'round',
        lineCap: 'round'
      })
      map.add(polylineRef.current)
    } else {
      polylineRef.current.setPath(pathCoords)
    }

    // Calculate KM Markers
    // We need to calculate cumulative distance
    // AMap.GeometryUtil.distance(p1, p2)

    // Clear existing KM markers first (inefficient but safe for now)
    // Optimization: Only add new ones if path grows? 
    // For simplicity, let's just re-calc. If performance is bad, optimize.

    // Actually, we should check if we already have markers for KMs.
    // e.g. if we have 2 markers (1km, 2km), and distance is 2.5km, we don't need to change anything.
    // If distance becomes 3.1km, we add 3km marker.

    let totalDist = 0
    let nextKmTarget = 1000 // 1km
    let markerIndex = 0 // Index in kmMarkersRef

    // We can't easily sync existing markers with recalculated path distances if path updates frequently.
    // But path usually appends.
    // Let's just do a full recalc for correctness, as path is usually < 1000 points.

    // Clear all
    map.remove(kmMarkersRef.current)
    kmMarkersRef.current = []

    for (let i = 0; i < path.length - 1; i++) {
      const p1 = [path[i].lng, path[i].lat] as [number, number]
      const p2 = [path[i + 1].lng, path[i + 1].lat] as [number, number]
      const d = AMap.GeometryUtil.distance(p1, p2)

      if (totalDist + d >= nextKmTarget) {
        // We crossed a KM boundary
        // Interpolate position? Or just use p2?
        // Using p2 is close enough for GPS tracks usually.
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

  }, [path])

  return (
    <div className="w-full h-full relative bg-slate-900">
      <div ref={mapContainerRef} className="w-full h-full absolute inset-0 z-0" />
      {/* Optional: Add gradient overlay if needed, but Smart Planner usually has clean map */}
    </div>
  )
}
