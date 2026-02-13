"use client"

import { useEffect, useRef, useState } from "react"
import MapManager from "@/lib/mapManager"
import { Location } from "@/hooks/useRunningTracker"
import { useTheme } from "next-themes"

// Security Config
const AMAP_KEY = process.env.NEXT_PUBLIC_AMAP_KEY || "2f65c697074e0d4c8270195561578e06"

interface RunningMapProps {
  userLocation?: [number, number]
  path?: Location[]
  startLocation?: [number, number]
  onLocationUpdate?: (lat: number, lng: number) => void
}

export function RunningMap({ 
  userLocation,
  path = [],
  startLocation,
  onLocationUpdate
}: RunningMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const amapRef = useRef<any>(null)
  
  // Refs for map elements
  const userMarkerRef = useRef<any>(null)
  const polylineRef = useRef<any>(null)
  const kmMarkersRef = useRef<any[]>([])

  // User Color Preferences (Hardcoded for now to match Smart Planner/Dark Theme)
  const pathColor = '#3B82F6' // Blue 500
  
  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return

    let destroyed = false;

    const init = async () => {
      try {
        // Setup Security Config - Required for AMap
        if (typeof window !== "undefined") {
            (window as any)._AMapSecurityConfig = { 
                securityJsCode: 'e827ba611fad4802c48dd900d01eb4bf',
            };
        }

        // Use AMapLoader directly to avoid interfering with the main map (MapManager singleton)
        // and to ensure we have an independent instance.
        const AMap = await import("@amap/amap-jsapi-loader").then(pkg => pkg.load({
            key: AMAP_KEY,
            version: "2.0",
            plugins: ["AMap.Polyline", "AMap.Marker", "AMap.GeometryUtil"]
        }));

        if (destroyed || !mapContainerRef.current) return;

        // Custom Map Style (Cyberpunk/Dark to match main map)
        const MAP_STYLE = "amap://styles/22e069175d1afe32e9542abefde02cb5";

        const map = new AMap.Map(mapContainerRef.current, {
          zoom: 17,
          center: userLocation || startLocation || [116.397, 39.909],
          mapStyle: MAP_STYLE, 
          skyColor: "#1f2029",
          viewMode: "2D", // 2D mode for performance and cleaner look
          showLabel: false, // Hide labels for cleaner runner view
        });

        // Add AMap.Geolocation plugin as active fallback
        map.plugin('AMap.Geolocation', function () {
            const geolocation = new AMap.Geolocation({
                enableHighAccuracy: true,
                timeout: 15000, // Match AMapView config
                maximumAge: 0,
                convert: true,
                showButton: false, // Hide button, we auto-locate
                showMarker: false, // We use custom marker
                showCircle: false,
                panToLocation: false, // We handle panning
                zoomToAccuracy: false,
                noGeoLocation: 0, // Force browser location (fix for Android WebView)
            });
            
            // If no userLocation provided initially, try to self-locate
            if (!userLocation) {
                console.log("[RunningMap] No initial location, attempting self-locate...");
                geolocation.getCurrentPosition(function(status: string, result: any) {
                    if (status === 'complete' && result.position) {
                        console.log("[RunningMap] Self-locate success:", result.position);
                        const { lat, lng } = result.position;
                        // Center map
                        map.setCenter([lng, lat]);
                        // Notify parent to sync
                        if (onLocationUpdate) {
                            onLocationUpdate(lat, lng);
                        }
                    } else {
                        console.warn("[RunningMap] Self-locate failed:", result);
                    }
                });
            }
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
             
             // If userLocation is provided, use it. Otherwise, hide marker initially.
             const initialPos = userLocation || startLocation || [116.397, 39.909];
             
             userMarkerRef.current = new AMap.Marker({
                 position: initialPos,
                 content: markerContent,
                 offset: new AMap.Pixel(-12, -12),
                 zIndex: 100,
                 visible: !!userLocation // Only visible if we have a real user location
             })
             
             // Check if map.add exists before calling
             // Note: MapManager might return a proxy or incomplete object if something went wrong
             if (map && typeof map.add === 'function') {
                 map.add(userMarkerRef.current)
             } else {
                 console.error("Map instance invalid - missing add method", map);
                 // Try to recover from global AMap if possible?
                 // No, just fail gracefully.
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
      if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.destroy();
          } catch(e) {}
          mapInstanceRef.current = null;
      }
    }
  }, []) // Init once

  // 2. Update User Location & Center
  useEffect(() => {
    if (!mapInstanceRef.current || !userMarkerRef.current || !userLocation) return
    
    // Update marker
    userMarkerRef.current.setPosition(userLocation)
    userMarkerRef.current.show()
    
    // Smooth Pan to user - Only pan if map center is far from user to allow manual interaction?
    // Or always center for running mode? Usually running apps lock to center.
    // Let's enforce center.
    mapInstanceRef.current.setCenter(userLocation)
    
  }, [userLocation])

  // 3. Render Path & KM Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !amapRef.current || !path || path.length < 2) return
    const map = mapInstanceRef.current
    const AMap = amapRef.current

    // Draw Polyline
    const pathCoords = path.map(p => [p.lng, p.lat])
    
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
        const p1 = [path[i].lng, path[i].lat]
        const p2 = [path[i+1].lng, path[i+1].lat]
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
