"use client"

import { useEffect, useRef, useState } from "react"
import AMapLoader from "@amap/amap-jsapi-loader"
import { h3ToAmapGeoJSON } from "@/lib/hex-utils"
import { useTheme } from "next-themes"
import { toast } from "sonner"

// Define global AMap types to avoid TS errors
declare global {
  interface Window {
    _AMapSecurityConfig: any
    AMap: any
    Loca: any
  }
}

interface ImmersiveMapProps {
  hexagons: string[]
  exploredHexes: string[]
  userLocation: [number, number]
  initialZoom?: number
}

// Security Config
const AMAP_KEY = process.env.NEXT_PUBLIC_AMAP_KEY || "68c9df43499703673c683777265a7f92"
const AMAP_SECURITY_CODE = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE || "37887556a31362e92c2810e742886e29"

export function ImmersiveMap({ 
  hexagons, 
  exploredHexes, 
  userLocation,
  initialZoom = 17 
}: ImmersiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const locaInstanceRef = useRef<any>(null)
  const prismLayerRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const [isMapReady, setIsMapReady] = useState(false)
  const [debugLog, setDebugLog] = useState<string[]>([])

  const addLog = (msg: string) => {
    console.log(`[ImmersiveMap] ${msg}`)
    setDebugLog(prev => [...prev.slice(-4), msg]) // Keep last 5 logs
  }

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return

    // Ensure Security Config is set BEFORE loading
    if (!(window as any)._AMapSecurityConfig) {
      (window as any)._AMapSecurityConfig = {
        securityJsCode: AMAP_SECURITY_CODE,
      }
      addLog("Security Config Set")
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
        mapStyle: "amap://styles/dark",
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
        mapInstanceRef.current.destroy()
      }
    }
  }, [])

  // 2. Render Data (Hardcoded Test + Real Data)
  useEffect(() => {
    if (!isMapReady || !prismLayerRef.current || !locaInstanceRef.current) return

    addLog(`Rendering Hexagons: ${hexagons.length}`)

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
    const realGeoJSON = h3ToAmapGeoJSON(hexagons)
    
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
         const isExplored = exploredHexes.includes(props.h3Index)
         return isExplored ? 'rgba(34, 197, 94, 0.6)' : 'rgba(100, 100, 100, 0.3)'
      },
      topColor: (index: number, feature: any) => {
         const props = feature.properties
         if (props.h3Index === 'DEBUG_HEX') return '#ff0000'
         const isExplored = exploredHexes.includes(props.h3Index)
         return isExplored ? '#22c55e' : '#3f3f46'
      },
      height: (index: number, feature: any) => {
         return feature.properties.height || 100
      },
      altitude: 0
    })

    addLog("Layer Style Set & Rendered")
    
  }, [isMapReady, hexagons, exploredHexes])

  // Update User Marker Position
  useEffect(() => {
    if (markerRef.current) {
        markerRef.current.setPosition(userLocation)
        // Only pan if map is ready
        if (mapInstanceRef.current) {
             mapInstanceRef.current.panTo(userLocation)
        }
    }
  }, [userLocation])

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
    </div>
  )
}
