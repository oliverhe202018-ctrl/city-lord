"use client"

import { useEffect, useRef, useState } from "react"
import { safeLoadAMap, safeDestroyMap } from '@/lib/map/safe-amap';
import { Location } from "@/hooks/useRunningTracker"
import { generateTerritoryStyle, generateNeutralTerritoryStyle } from "@/lib/citylord/territory-renderer"
import { ViewContext, ExtTerritory } from "@/types/city"
import { useGameTerritoryAppearance } from "@/store/useGameStore";

// Define global AMap types to avoid TS errors
declare global {
  interface Window {
    _AMapSecurityConfig: any
    // AMap: any // Commented out to avoid conflict with existing types
    Loca: any
  }
}

// Utility to ensure map style is valid
function resolveMapStyle(style?: string): string {
  if (!style || typeof style !== 'string' || !style.startsWith('amap://styles/')) {
    return 'amap://styles/normal';
  }
  return style;
}

interface GaodeMap3DProps {
  userLocation: [number, number]
  initialZoom?: number
  territories?: ExtTerritory[]
  path?: Location[]
  ghostPath?: Location[]
  closedPolygons?: Location[][]
}

// Security Config
const AMAP_KEY = process.env.NEXT_PUBLIC_AMAP_KEY || ""
const AMAP_SECURITY_CODE = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE || "37887556a31362e92c2810e742886e29"

export function GaodeMap3D({
  userLocation,
  initialZoom = 17,
  territories = [],
  path = [],
  ghostPath = [],
  closedPolygons = []
}: GaodeMap3DProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const locaInstanceRef = useRef<any>(null)
  const prismLayerRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const isUserInteracting = useRef(false)
  const [isMapReady, setIsMapReady] = useState(false)
  const [debugLog, setDebugLog] = useState<string[]>([])

  // Path & Polygon Refs
  const polylineRef = useRef<any>(null)
  const ghostPolylineRef = useRef<any>(null)
  const polygonRefs = useRef<any[]>([])
  const reqAnimIdRef = useRef<number | null>(null)
  const destroyedRef = useRef(false)
<<<<<<< HEAD
  const { territoryAppearance } = useGameTerritoryAppearance()
=======

  // User Color Preferences
  const [pathColor, setPathColor] = useState('#3B82F6')
  const [fillColor, setFillColor] = useState('#3B82F6')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Load user colors
  useEffect(() => {
    const loadColors = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        try {
          const { data } = await supabase
            .from('profiles')
            .select('path_color, fill_color')
            .eq('id', user.id)
            .single()
          if (data) {
            if (data.path_color) setPathColor(data.path_color)
            if (data.fill_color) setFillColor(data.fill_color)
          }
        } catch (e) {
          console.warn('Failed to fetch user colors', e)
        }
      }
    }
    loadColors()
  }, [])
>>>>>>> 8c67c67 (fix(UAT): resolve Android keep-alive, theme switcher UI overflow, and pace state leakage)

  const addLog = (msg: string) => {
    console.log(`[GaodeMap3D] ${msg}`)
    setDebugLog(prev => [...prev.slice(-4), msg]) // Keep last 5 logs
  }

  // Safe Data Access
  const safeTerritories = territories || []
  const safePath = path || []
  const safeClosedPolygons = closedPolygons || []

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return

    destroyedRef.current = false;
    (async () => {
      try {
        const AMap = await safeLoadAMap({
          plugins: ["AMap.Scale", "AMap.ToolBar", "AMap.ControlBar", "AMap.MoveAnimation"],
          Loca: {
            version: "2.0.0"
          }
        });

        if (destroyedRef.current) return;

        if (!AMap || !mapContainerRef.current) {
          addLog("AMap Load Failed or Container Missing");
          return;
        }

        addLog("AMap Loader Success")

        // Read cached location for instant center (avoid distant default)
        let initCenter: [number, number] = userLocation;
        if (typeof window !== 'undefined') {
          try {
            const cached = localStorage.getItem('last_known_location')
            if (cached) {
              const parsed = JSON.parse(cached)
              if (parsed?.lat && parsed?.lng &&
                typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
                initCenter = [parsed.lng, parsed.lat]
              }
            }
          } catch {
            // Silently fall back to prop center
          }
        }

        // Create Map Instance
        const map = new AMap.Map(mapContainerRef.current, {
          viewMode: "3D",
          zoom: 16, // Force zoom level for Loca
          center: initCenter,
          pitch: 50, // 3D Tilt (45-60 is recommended)
          rotation: 0,
          mapStyle: resolveMapStyle("amap://styles/22e069175d1afe32e9542abefde02cb5"),
          showLabel: false,
          skyColor: '#1f2029'
        })

        // Register drag interaction tracking
        map.on('dragstart', () => { isUserInteracting.current = true })
        map.on('dragend', () => { isUserInteracting.current = false })

        mapInstanceRef.current = map
        addLog("Map Instance Created")

        // Add ControlBar for Manual Tilt/Rotation
        const controlBar = new AMap.ControlBar({
          position: {
            right: '10px',
            top: '10px'
          }
        })
        map.addControl(controlBar)

        // Create Loca Container
        if (!window.Loca) {
          throw new Error("Loca not loaded");
        }

        const loca = new window.Loca.Container({
          map,
        })
        locaInstanceRef.current = loca

        // prismLayer is kept for future polygon rendering or dummy layer
        const prismLayer = new window.Loca.PrismLayer({
          zIndex: 10,
          opacity: 1,
          cullface: 'none',
          hasSide: true
        })
        loca.add(prismLayer)
        prismLayerRef.current = prismLayer

        // Add User Marker
        if (!markerRef.current) {
          const marker = new AMap.Marker({
            position: userLocation,
            content: `<div style="
              width: 20px; 
              height: 20px; 
              background: #22c55e; 
              border-radius: 50%; 
              box-shadow: 0 0 15px #22c55e;
              border: 3px solid white;
            "></div>`,
            offset: new AMap.Pixel(-10, -10)
          })
          map.add(marker)
          markerRef.current = marker
        }

        setIsMapReady(true)

        const animate = () => {
          reqAnimIdRef.current = requestAnimationFrame(animate)
          loca.animate.start()
        }
        animate()

      } catch (e: any) {
        console.error("AMap Load Failed:", e)
        addLog(`Load Error: ${e.message}`)
        
        // Fallback for style or initialization failure
        if (mapInstanceRef.current && !destroyedRef.current) {
          try {
            console.warn('[AMap] 样式设置失败，已降级:', e)
            mapInstanceRef.current.setMapStyle("amap://styles/normal")
          } catch (styleErr) {
            console.warn('[AMap] 降级样式设置亦失败:', styleErr)
          }
        }
      }
    })();

    return () => {
      destroyedRef.current = true;
      if (mapInstanceRef.current) {
<<<<<<< HEAD
=======
        // Explicitly destroy the map instance to prevent WebView crashes
>>>>>>> 8c67c67 (fix(UAT): resolve Android keep-alive, theme switcher UI overflow, and pace state leakage)
        try {
          if (polylineRef.current) {
            mapInstanceRef.current.remove(polylineRef.current);
            polylineRef.current = null;
          }
          if (ghostPolylineRef.current) {
            mapInstanceRef.current.remove(ghostPolylineRef.current);
            ghostPolylineRef.current = null;
          }
          if (markerRef.current) {
             mapInstanceRef.current.remove(markerRef.current);
             markerRef.current = null;
          }
          if (polygonRefs.current && polygonRefs.current.length > 0) {
             mapInstanceRef.current.remove(polygonRefs.current);
             polygonRefs.current = [];
          }
          
          if (locaInstanceRef.current) {
             locaInstanceRef.current.destroy();
             locaInstanceRef.current = null;
          }

          mapInstanceRef.current.destroy?.();
        } catch (e) {
<<<<<<< HEAD
          console.warn('Failed to clean up map overlays:', e);
=======
          console.warn('Failed to destroy map instance:', e);
<<<<<<< HEAD
=======
        }

        // Safe Cleanup using optional chaining
        ghostPolylineRef.current?.remove?.()
        polylineRef.current?.remove?.()

        // Handle array cleanup
        if (Array.isArray(polygonRefs.current)) {
          polygonRefs.current.forEach((p: any) => p?.remove?.())
>>>>>>> 8c67c67 (fix(UAT): resolve Android keep-alive, theme switcher UI overflow, and pace state leakage)
>>>>>>> b75abf72a1fcd21ecee74c77b76a8389b226bdff
        }
        safeDestroyMap(mapInstanceRef.current);
        mapInstanceRef.current = null;
      }
    }
  }, [])

  // User Marker Postion Update
  useEffect(() => {
    if (!markerRef.current || !userLocation) return
    markerRef.current.setPosition(userLocation)
    if (isUserInteracting.current || !mapInstanceRef.current) return
    mapInstanceRef.current.panTo(userLocation)
  }, [userLocation])

  // Path & Polygon (Existing logic kept for real-time tracking)
  useEffect(() => {
    if (!mapInstanceRef.current || !isMapReady) return
    const map = mapInstanceRef.current

    const safePathArr = path || []
    const pathCoordinates = safePathArr.map(p => [p.lng, p.lat])

    if (pathCoordinates.length > 0) {
      if (polylineRef.current) {
        polylineRef.current.setPath(pathCoordinates)
        polylineRef.current.setOptions({ strokeColor: territoryAppearance.strokeColor })
      } else {
        polylineRef.current = new window.AMap.Polyline({
// @ts-expect-error - Baseline exemption for pre-existing schema mismatch - [Ticket-202603-SchemaSync] baseline exemption
          path: pathCoordinates,
          strokeColor: territoryAppearance.strokeColor,
          strokeWeight: 6,
          strokeOpacity: 0.9,
          zIndex: 100,
          showDir: true
        })
        map.add(polylineRef.current)
      }
    }

    if (closedPolygons && closedPolygons.length > 0) {
        // ... (Keep polygon logic similar to KingdomLayer if needed, but GaodeMap3D usually for tracking)
    }
  }, [closedPolygons, isMapReady, path, territoryAppearance.strokeColor])

  return (
    <div className="w-full h-full relative bg-black">
      <div ref={mapContainerRef} className="w-full h-full absolute inset-0 z-0" />
      {!isMapReady && (
        <div className="absolute inset-0 flex items-center justify-center text-white/50 text-xs z-10">
          Loading AMap Engine...
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40 pointer-events-none" />
    </div>
  )
}
