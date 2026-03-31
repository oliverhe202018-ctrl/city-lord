"use client"

import { useEffect, useRef } from "react"
import { safeDestroyMap, safeLoadAMap } from "@/lib/map/safe-amap"

interface StartRunMapProps {
  currentLocation?: [number, number]
  plannedPath?: [number, number][]
  recenterTrigger?: number
}

const MAP_STYLE = "amap://styles/22e069175d1afe32e9542abefde02cb5"

export function StartRunMap({ currentLocation, plannedPath = [], recenterTrigger = 0 }: StartRunMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<AMap.Map | null>(null)
  const amapRef = useRef<typeof AMap | null>(null)
  const userMarkerRef = useRef<AMap.Marker | null>(null)
  const plannedPolylineRef = useRef<AMap.Polyline | null>(null)

  useEffect(() => {
    if (!mapContainerRef.current) return
    let destroyed = false

    const init = async () => {
      const AMap = await safeLoadAMap({
        plugins: ["AMap.Marker", "AMap.Polyline"],
      })
      if (!AMap || destroyed || !mapContainerRef.current) return

      const center = currentLocation || [116.397, 39.909]
      const map = new AMap.Map(mapContainerRef.current, {
        zoom: 17,
        center,
        mapStyle: MAP_STYLE,
        viewMode: "2D",
        skyColor: "#f8fafc",
        showLabel: false,
      })
      mapInstanceRef.current = map
      amapRef.current = AMap

      const markerContent = `
        <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 100%; height: 100%; background-color: rgba(34, 197, 94, 0.28); border-radius: 50%; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: relative; width: 12px; height: 12px; background-color: #22c55e; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 0 10px rgba(34, 197, 94, 0.6);"></div>
        </div>
        <style>
          @keyframes ping {
            75%, 100% { transform: scale(2); opacity: 0; }
          }
        </style>
      `

      userMarkerRef.current = new AMap.Marker({
        position: center,
        content: markerContent,
        offset: new AMap.Pixel(-12, -12),
        zIndex: 100,
      })
      map.add(userMarkerRef.current)
    }

    init()

    return () => {
      destroyed = true
      if (mapInstanceRef.current && typeof mapInstanceRef.current.destroy === "function") {
        mapInstanceRef.current.destroy()
      }
      safeDestroyMap(mapInstanceRef.current)
      mapInstanceRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!currentLocation || !mapInstanceRef.current || !userMarkerRef.current) return
    userMarkerRef.current.setPosition(currentLocation)
    mapInstanceRef.current.panTo(currentLocation)
  }, [currentLocation])

  useEffect(() => {
    if (!mapInstanceRef.current || !amapRef.current) return
    const map = mapInstanceRef.current
    const AMap = amapRef.current

    if (!plannedPath.length) {
      if (plannedPolylineRef.current) {
        map.remove(plannedPolylineRef.current)
        plannedPolylineRef.current = null
      }
      return
    }

    if (!plannedPolylineRef.current) {
      plannedPolylineRef.current = new AMap.Polyline({
        path: plannedPath,
        strokeColor: "#2563eb",
        strokeOpacity: 0.95,
        strokeWeight: 6,
        zIndex: 70,
        lineJoin: "round",
        lineCap: "round",
      })
      map.add(plannedPolylineRef.current)
    } else {
      plannedPolylineRef.current.setPath(plannedPath)
    }

    map.setFitView([plannedPolylineRef.current], false, [80, 80, 280, 80], 17)
  }, [plannedPath])

  useEffect(() => {
    if (!mapInstanceRef.current || !currentLocation) return
    mapInstanceRef.current.setZoom(17)
    mapInstanceRef.current.panTo(currentLocation)
  }, [currentLocation, recenterTrigger])

  return (
    <div className="absolute inset-0 bg-slate-100 dark:bg-slate-900">
      <div ref={mapContainerRef} className="h-full w-full" />
    </div>
  )
}
