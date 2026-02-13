"use client"

import { useEffect, useRef, useState } from "react"
import AMapLoader from "@amap/amap-jsapi-loader"
import { h3ToAmapGeoJSON } from "@/lib/citylord/map-utils"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Location } from "@/hooks/useRunningTracker"

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
  // Optional: Pass full territory objects to render health
  territories?: { id: string; health?: number; ownerType: 'me' | 'enemy' | 'neutral' }[]
  path?: Location[]
  ghostPath?: Location[]
  closedPolygons?: Location[][]
}

// Security Config
const AMAP_KEY = process.env.NEXT_PUBLIC_AMAP_KEY || "2f65c697074e0d4c8270195561578e06"
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
  const [isMapReady, setIsMapReady] = useState(false)
  const [debugLog, setDebugLog] = useState<string[]>([])
  
  // Path & Polygon Refs
  const polylineRef = useRef<any>(null)
  const ghostPolylineRef = useRef<any>(null)
  const polygonRefs = useRef<any[]>([])

  // User Color Preferences
  const [pathColor, setPathColor] = useState('#3B82F6')
  const [fillColor, setFillColor] = useState('#3B82F6')

  // Load user colors
  useEffect(() => {
    const loadColors = async () => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data } = await supabase
                .from('profiles')
                .select('path_color, fill_color')
                .eq('id', user.id)
                .single()
            if (data) {
                if (data.path_color) setPathColor(data.path_color)
                if (data.fill_color) setFillColor(data.fill_color)
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

    // Ensure Security Config is set BEFORE loading (Force hardcoded key for safety)
    if (typeof window !== "undefined") {
      (window as any)._AMapSecurityConfig = {
        securityJsCode: 'e827ba611fad4802c48dd900d01eb4bf',
      }
      addLog("Security Config Set (Hardcoded)")
    }

    AMapLoader.load({
      key: AMAP_KEY,
      version: "2.0",
      plugins: ["AMap.Scale", "AMap.ToolBar", "AMap.ControlBar", "AMap.MoveAnimation"],
      Loca: {
        version: "2.0.0"
      }
    }).then((AMap) => {
      addLog("AMap Loader Success")

      // Create Map Instance
      const map = new AMap.Map(mapContainerRef.current, {
        viewMode: "3D",
        zoom: 16, // Force zoom level for Loca
        center: userLocation,
        pitch: 50, // 3D Tilt (45-60 is recommended)
        rotation: 0,
        mapStyle: "amap://styles/22e069175d1afe32e9542abefde02cb5",
        showLabel: false,
        skyColor: '#1f2029'
      })

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

      setIsMapReady(true)

      // Animation Loop
      const animate = () => {
        // loca.viewControl.addAnimFrame(animate) // Deprecated in some versions, simpler way:
        requestAnimationFrame(animate)
        loca.animate.start()
      }
      animate()

    }).catch(e => {
      console.error("AMap Load Failed:", e)
      addLog(`Load Error: ${e.message}`)
    })

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
        
        mapInstanceRef.current.destroy()
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
    
    // Enrich with Health Data if available
    if (safeTerritories.length > 0) {
      realGeoJSON.features.forEach((feature: any) => {
        const t = safeTerritories.find(t => t.id === feature.properties.h3Index)
        if (t) {
          feature.properties.health = t.health ?? 100
          feature.properties.ownerType = t.ownerType
        } else {
          feature.properties.health = 100
          feature.properties.ownerType = 'neutral'
        }
      })
    }

    // Merge Debug Data if list is empty
    let finalFeatures = realGeoJSON.features
    if (finalFeatures.length === 0) {
        addLog("No hexagons provided, adding DEBUG feature")
        finalFeatures = [debugFeature as any]
    } else {
        // Optional: Always add debug feature to ensure rendering works
        // finalFeatures.push(debugFeature as any)
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
         
         const health = props.health ?? 100
         const ownerType = props.ownerType || (exploredHexes.includes(props.h3Index) ? 'me' : 'neutral')
         
         // Base color by faction
         let baseColor = 'rgba(100, 100, 100, 0.3)'
         if (ownerType === 'me') baseColor = 'rgba(34, 197, 94, 0.6)' // Green
         else if (ownerType === 'enemy') baseColor = 'rgba(168, 85, 247, 0.6)' // Purple
         
         // Health Modifier (Darker/Greyer as health drops)
         if (health < 40) {
            // Critical: Flashing Red/Grey look (simulated by low opacity or red tint)
            return 'rgba(239, 68, 68, 0.4)' 
         } else if (health < 80) {
            // Damaged: Yellow tint
            return 'rgba(234, 179, 8, 0.5)'
         }
         
         return baseColor
      },
      topColor: (index: number, feature: any) => {
         const props = feature.properties
         if (props.h3Index === 'DEBUG_HEX') return '#ff0000'
         
         const health = props.health ?? 100
         const ownerType = props.ownerType || (exploredHexes.includes(props.h3Index) ? 'me' : 'neutral')

         // Base color
         let color = '#3f3f46'
         if (ownerType === 'me') color = '#22c55e'
         else if (ownerType === 'enemy') color = '#a855f7'
         
         // Health Modifier
         if (health < 40) {
            return '#ef4444' // Red for critical
         } else if (health < 80) {
            return '#eab308' // Yellow for damaged
         }
         
         return color
      },
      height: (index: number, feature: any) => {
         // Lower height for low health?
         const health = feature.properties.health ?? 100
         const baseHeight = feature.properties.height || 100
         return baseHeight * (0.5 + (health / 200)) // 50% to 100% height based on health
      },
      altitude: 0
    })

    // Add Click Interaction for Health Status
    // Loca doesn't have direct 'click' on layer in 2.0 the same way as 1.3 sometimes, 
    // but usually pickFeature works.
    // Let's try adding a click listener to the map and using queryFeature (if supported) or rely on layer events.
    // Loca 2.0 PrismLayer usually supports events if configured? 
    // Actually Loca is for visualization. Interaction is often done via picking.
    // For simplicity, we just log health on click if we can.
    
    // Note: Loca 2.0 requires manual picking often.
    mapInstanceRef.current.on('click', (e: any) => {
        const feat = layer.queryFeature(e.pixel)
        if (feat) {
            const props = feat.properties
            const health = props.health ?? 100
            let status = "Healthy"
            if (health < 40) status = "Critical (Lost in <4 days)"
            else if (health < 80) status = "Damaged"
            
            toast(`Hex ${props.h3Index.substring(0,6)}...`, {
                description: `Health: ${health}% (${status})`
            })
        }
    })

    addLog("Layer Style Set & Rendered")
    
  }, [isMapReady, safeHexagons, exploredHexes, safeTerritories])

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
       map.remove(ghostPolylineRef.current)
       ghostPolylineRef.current = null
    }

    // Note: Path and ClosedPolygons are handled in separate effects to avoid conflicts

  }, [isMapReady, ghostPath]) // Removed path, closedPolygons from dependencies

  // Update User Marker Position
  useEffect(() => {
    if (markerRef.current && userLocation) {
        markerRef.current.setPosition(userLocation)
        // Only pan if map is ready
        if (mapInstanceRef.current) {
             mapInstanceRef.current.panTo(userLocation)
        }
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
       mapInstanceRef.current.remove(polylineRef.current)
       polylineRef.current = null
    }
  }, [path, pathColor, isMapReady])

  // 4. Render Closed Polygons
  useEffect(() => {
    if (!mapInstanceRef.current || !window.AMap || !isMapReady) return

    // Clear existing polygons
    if (polygonRefs.current && polygonRefs.current.length > 0) {
        mapInstanceRef.current.remove(polygonRefs.current)
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
      }).filter(Boolean) // Filter out nulls

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
