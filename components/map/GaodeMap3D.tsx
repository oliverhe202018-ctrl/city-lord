"use client"

import { useEffect, useRef, useState } from "react"
import { safeLoadAMap, safeDestroyMap } from '@/lib/map/safe-amap';
import { h3ToAmapGeoJSON } from "@/lib/citylord/map-utils"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Location } from "@/hooks/useRunningTracker"
import { generateTerritoryStyle, generateNeutralTerritoryStyle } from "@/lib/citylord/territory-renderer"
import { ViewContext, ExtTerritory } from "@/types/city"

// Define global AMap types to avoid TS errors
declare global {
  interface Window {
    _AMapSecurityConfig: any
    AMap: any
    Loca: any
  }
}

interface GaodeMap3DProps {
  hexagons: string[]
  exploredHexes: string[]
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
  hexagons,
  exploredHexes,
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

  const addLog = (msg: string) => {
    console.log(`[GaodeMap3D] ${msg}`)
    setDebugLog(prev => [...prev.slice(-4), msg]) // Keep last 5 logs
  }

  // Safe Data Access
  const safeHexagons = hexagons || []
  const safeTerritories = territories || []
  const safePath = path || []
  const safeClosedPolygons = closedPolygons || []

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return

    (async () => {
      try {
        const AMap = await safeLoadAMap({
          plugins: ["AMap.Scale", "AMap.ToolBar", "AMap.ControlBar", "AMap.MoveAnimation"],
          Loca: {
            version: "2.0.0"
          }
        });

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
          mapStyle: "amap://styles/22e069175d1afe32e9542abefde02cb5",
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
        // Ensure Loca is available on window
        if (!window.Loca) {
          throw new Error("Loca not loaded");
        }

        const loca = new window.Loca.Container({
          map,
        })
        locaInstanceRef.current = loca
        addLog("Loca Container Created")

        // Add Lights
        loca.ambLight = {
          intensity: 0.6,
          color: '#fff',
        }
        loca.dirLight = {
          intensity: 1.0,
          color: '#fff',
          target: [0, 0, 0],
          position: [0, -1, 1],
        }
        loca.pointLight = {
          color: 'rgb(100,100,100)',
          position: [userLocation[0], userLocation[1], 1000],
          intensity: 1.5,
          distance: 5000,
        }
        addLog("Lights Added")

        // Initialize Prism Layer
        const prismLayer = new window.Loca.PrismLayer({
          zIndex: 10,
          opacity: 1,
          cullface: 'none', // Ensure both sides visible
          hasSide: true
        })
        loca.add(prismLayer)
        prismLayerRef.current = prismLayer
        addLog("Prism Layer Added")

        // Add User Marker
        // Only add if there is NO existing marker (shouldn't happen with refs but safety first)
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

        // Animation Loop
        const animate = () => {
          reqAnimIdRef.current = requestAnimationFrame(animate)
          loca.animate.start()
        }
        animate()

      } catch (e: any) {
        console.error("AMap Load Failed:", e)
        addLog(`Load Error: ${e.message}`)
      }
    })();

    return () => {
      if (mapInstanceRef.current) {
        // Safe Cleanup using optional chaining
        ghostPolylineRef.current?.remove?.()
        polylineRef.current?.remove?.()

        // Handle array cleanup
        if (Array.isArray(polygonRefs.current)) {
          polygonRefs.current.forEach((p: any) => p?.remove?.())
        }

        markerRef.current?.remove?.()

        if (reqAnimIdRef.current !== null) {
          cancelAnimationFrame(reqAnimIdRef.current);
          reqAnimIdRef.current = null;
        }

        safeDestroyMap(mapInstanceRef.current);
        mapInstanceRef.current = null;
      }
    }
  }, [])

  // 2. Render Data (Hardcoded Test + Real Data)
  useEffect(() => {
    if (!isMapReady || !prismLayerRef.current || !locaInstanceRef.current) return

    addLog(`Rendering Hexagons: ${safeHexagons.length}`)

    // --- DEBUG: Hardcoded Hexagon near Beijing Tiananmen ---
    // [116.397, 39.909]
    // Standard GeoJSON Polygon
    const debugFeature = {
      "type": "Feature",
      "properties": {
        "h3Index": "DEBUG_HEX",
        "color": "#ff0000",
        "height": 500
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [116.397, 39.909],
            [116.398, 39.909],
            [116.398, 39.910],
            [116.397, 39.910],
            [116.397, 39.909]
          ]
        ]
      }
    }

    // Convert Real Data
    const realGeoJSON = h3ToAmapGeoJSON(safeHexagons)

    // Build Territory Map for O(1) matching
    const territoryMap = new Map();
    safeTerritories.forEach(t => territoryMap.set(t.id, t));

    const ctx: ViewContext = {
      userId: currentUserId,
      subject: 'individual' // default to individual for immersive mode unless specified
    };

    // Enrich with Health Data and Precompute Styles
    if (safeHexagons.length > 0) {
      realGeoJSON.features.forEach((feature: any) => {
        const t = territoryMap.get(feature.properties.h3Index);
        if (t) {
          feature.properties._styleCache = generateTerritoryStyle(t, ctx);
          feature.properties.health = t.health ?? 1000;
          feature.properties.maxHealth = t.maxHealth ?? 1000;
          feature.properties.ownerType = t.ownerType;
        } else {
          feature.properties._styleCache = generateNeutralTerritoryStyle(ctx);
          feature.properties.health = 1000;
          feature.properties.maxHealth = 1000;
          feature.properties.ownerType = 'neutral';
        }
      })
    }

    // Merge Debug Data if list is empty
    let finalFeatures = realGeoJSON.features
    if (finalFeatures.length === 0) {
      addLog("No hexagons provided, adding DEBUG feature")
      // Quick dummy context
      debugFeature.properties.health = 1000;
      (debugFeature.properties as any)._styleCache = generateNeutralTerritoryStyle(ctx);
      finalFeatures = [debugFeature as any]
    }

    const source = new window.Loca.GeoJSONSource({
      data: {
        type: 'FeatureCollection',
        features: finalFeatures
      }
    })

    const layer = prismLayerRef.current
    layer.setSource(source)

    layer.setStyle({
      unit: 'meter',
      sideColor: (index: number, feature: any) => {
        const props = feature.properties
        if (props.h3Index === 'DEBUG_HEX') return 'rgba(255, 0, 0, 0.5)'
        return props._styleCache?.sideColor || 'rgba(100, 100, 100, 0.3)'
      },
      topColor: (index: number, feature: any) => {
        const props = feature.properties
        if (props.h3Index === 'DEBUG_HEX') return '#ff0000'
        return props._styleCache?.topColor || '#3f3f46'
      },
      height: (index: number, feature: any) => {
        const baseHeight = feature.properties.height || 100
        const scale = feature.properties._styleCache?.heightScale ?? 1.0;
        return baseHeight * scale
      },
      altitude: 0
    })

    // Click Interaction
    // Note: Loca 2.0 requires manual picking often.
    mapInstanceRef.current.on('click', (e: any) => {
      const feat = layer.queryFeature(e.pixel)
      if (feat) {
        const props = feat.properties
        const health = props.health ?? 1000
        const maxHealth = props.maxHealth ?? 1000

        let status = "Healthy"
        if (props._styleCache?.isCritical) status = "Critical (Lost in <4 days)"
        else if (props._styleCache?.isDamaged) status = "Damaged"

        toast(`Hex ${props.h3Index.substring(0, 6)}...`, {
          description: `Health: ${health}/${maxHealth} (${status})`
        })
      }
    })

    addLog("Layer Style Set & Rendered")

  }, [isMapReady, safeHexagons, exploredHexes, safeTerritories, currentUserId])

  // Path & Polygon Rendering
  useEffect(() => {
    if (!mapInstanceRef.current || !isMapReady) return
    const map = mapInstanceRef.current

    // 0. Draw Ghost Path (Polyline)
    if (ghostPath && ghostPath.length > 0) {
      const ghostCoords = ghostPath.map(p => [p.lng, p.lat])

      if (!ghostPolylineRef.current) {
        ghostPolylineRef.current = new window.AMap.Polyline({
          path: ghostCoords,
          strokeColor: "#a855f7",
          strokeOpacity: 0.6,
          strokeWeight: 6,
          strokeStyle: "dashed",
          strokeDasharray: [10, 10],
          zIndex: 45,
        })
        map.add(ghostPolylineRef.current)
      } else {
        ghostPolylineRef.current.setPath(ghostCoords)
      }
    } else if (ghostPolylineRef.current) {
      map?.remove?.(ghostPolylineRef.current)
      ghostPolylineRef.current = null
    }

    // Note: Path and ClosedPolygons are handled in separate effects to avoid conflicts

  }, [isMapReady, ghostPath]) // Removed path, closedPolygons from dependencies

  // Update User Marker Position (with distance guard and interaction check)
  useEffect(() => {
    if (!markerRef.current || !userLocation) return

    try {
      markerRef.current.setPosition(userLocation)
    } catch {
      // Marker may have been removed
      return
    }

    // Don't recenter if user is dragging or map not ready
    if (isUserInteracting.current || !mapInstanceRef.current) return

    try {
      // Use AMap.GeometryUtil.distance for accurate distance check
      const currentCenter = mapInstanceRef.current.getCenter()
      if (!currentCenter) return

      const AMapLib = window.AMap
      let dist = 0
      if (AMapLib?.GeometryUtil?.distance) {
        dist = AMapLib.GeometryUtil.distance(
          userLocation,
          [currentCenter.lng, currentCenter.lat]
        )
      } else {
        // Fallback approximation
        dist = Math.sqrt(
          Math.pow((currentCenter.lat - userLocation[1]) * 111000, 2) +
          Math.pow((currentCenter.lng - userLocation[0]) * 111000 * Math.cos(currentCenter.lat * Math.PI / 180), 2)
        )
      }

      // Only panTo if drift > 100m (prevents micro-jitter)
      if (dist > 100) {
        mapInstanceRef.current.panTo(userLocation)
      }
    } catch {
      // Silently handle panTo/distance errors on unmounted map
    }

    // Save to cache for next cold start
    try {
      localStorage.setItem('last_known_location', JSON.stringify({
        lat: userLocation[1], lng: userLocation[0], zoom: 16
      }))
    } catch {
      // localStorage may be full or unavailable
    }
  }, [userLocation])

  // 3. Render Path (Polyline)
  useEffect(() => {
    if (!mapInstanceRef.current || !window.AMap || !isMapReady) return

    const safePathArr = path || []
    if (!Array.isArray(safePathArr)) return

    // Defensive check: Ensure all points are valid
    const pathCoordinates = safePathArr
      .filter(p => p && typeof p.lng === 'number' && typeof p.lat === 'number')
      .map(p => [p.lng, p.lat])

    if (pathCoordinates.length > 0) {
      if (polylineRef.current) {
        // Update existing polyline
        polylineRef.current.setPath(pathCoordinates)
        polylineRef.current.setOptions({ strokeColor: pathColor })
      } else {
        // Create new polyline
        polylineRef.current = new window.AMap.Polyline({
          path: pathCoordinates,
          strokeColor: pathColor,
          strokeWeight: 6,
          strokeOpacity: 0.9,
          zIndex: 100,
          showDir: true
        })
        mapInstanceRef.current.add(polylineRef.current)
      }
    } else if (polylineRef.current) {
      // Clear if empty
      mapInstanceRef.current?.remove?.(polylineRef.current)
      polylineRef.current = null
    }
  }, [path, pathColor, isMapReady])

  // 4. Render Closed Polygons
  useEffect(() => {
    if (!mapInstanceRef.current || !window.AMap || !isMapReady) return

    // Clear existing polygons
    if (polygonRefs.current && polygonRefs.current.length > 0) {
      mapInstanceRef.current?.remove?.(polygonRefs.current)
      polygonRefs.current = []
    }

    const safePolys = closedPolygons || []
    if (!Array.isArray(safePolys)) return

    // Add new polygons
    if (safePolys.length > 0) {
      const newPolygons = safePolys
        .filter(poly => Array.isArray(poly) && poly.length > 0)
        .map(poly => {
          const coords = poly
            .filter(p => p && typeof p.lng === 'number' && typeof p.lat === 'number')
            .map(p => [p.lng, p.lat])

          if (coords.length < 3) return null // Need at least 3 points for a polygon

          return new window.AMap.Polygon({
            path: coords,
            strokeColor: pathColor,
            strokeWeight: 2,
            strokeOpacity: 0.8,
            fillColor: fillColor,
            fillOpacity: 0.4,
            zIndex: 90
          })
        }).filter(p => !!p) // Filter out nulls

      if (newPolygons.length > 0) {
        mapInstanceRef.current.add(newPolygons)
        polygonRefs.current = newPolygons
      }
    }
  }, [closedPolygons, pathColor, fillColor, isMapReady])

  return (
    <div className="w-full h-full relative bg-black">
      <div ref={mapContainerRef} className="w-full h-full absolute inset-0 z-0" />

      {/* Debug Log Overlay */}
      {/* 
      <div className="absolute top-20 left-4 z-50 pointer-events-none">
        <div className="bg-black/50 text-green-400 text-[10px] font-mono p-2 rounded max-w-[200px]">
            <p className="font-bold underline mb-1">AMap Debug</p>
            {debugLog.map((log, i) => (
                <div key={i}>{`> ${log}`}</div>
            ))}
            <div className="mt-1 text-white">
               Loc: {userLocation[0].toFixed(4)}, {userLocation[1].toFixed(4)}
            </div>
        </div>
      </div>
      */}

      {!isMapReady && (
        <div className="absolute inset-0 flex items-center justify-center text-white/50 text-xs z-10">
          Loading AMap Engine...
        </div>
      )}

      {/* Gradient Overlay for text readability - Adjusted for visibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40 pointer-events-none" />
    </div>
  )
}
