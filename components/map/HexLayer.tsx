"use client"

import { useEffect, useRef } from "react"
import { useMap } from "./MapContext"
import { HexCellData } from "./HexDetailSheet"
import { toast } from "sonner"

interface HexLayerProps {
  cells: HexCellData[]
  onCellClick: (cell: HexCellData) => void
}

export function HexLayer({ cells, onCellClick }: HexLayerProps) {
  const { map, AMap } = useMap()
  const polygonsRef = useRef<any[]>([])
  
  // Style config
  const getStyle = (status: string) => {
    switch (status) {
      case "owned":
        return {
          strokeColor: "#22c55e", // Green
          fillColor: "#22c55e",
          fillOpacity: 0.3,
          strokeOpacity: 0.8,
          strokeWeight: 2,
        }
      case "enemy":
        return {
          strokeColor: "#ef4444", // Red
          fillColor: "#ef4444",
          fillOpacity: 0.3,
          strokeOpacity: 0.8,
          strokeWeight: 2,
        }
      case "neutral":
        return {
          strokeColor: "#94a3b8", // Slate
          fillColor: "#94a3b8",
          fillOpacity: 0.1,
          strokeOpacity: 0.5,
          strokeWeight: 1,
        }
      case "contested":
        return {
          strokeColor: "#f97316", // Orange
          fillColor: "#f97316",
          fillOpacity: 0.4,
          strokeOpacity: 0.9,
          strokeWeight: 2,
          strokeStyle: "dashed",
        }
      case "fog":
        return {
          strokeColor: "#1e293b", // Dark Slate
          fillColor: "#0f172a",
          fillOpacity: 0.4,
          strokeOpacity: 0,
          strokeWeight: 0,
        }
      default:
        return {
          strokeColor: "#94a3b8",
          fillColor: "#94a3b8",
          fillOpacity: 0.1,
          strokeOpacity: 0.5,
          strokeWeight: 1,
        }
    }
  }

  useEffect(() => {
    if (!map || !AMap || !cells.length) return

    // Clear existing polygons
    if (polygonsRef.current.length) {
      map.remove(polygonsRef.current)
      polygonsRef.current = []
    }

    // Performance warning
    if (cells.length > 500) {
      console.warn("HexLayer: High number of polygons may affect performance. Consider clustering or culling.")
    }

    const newPolygons: any[] = []

    cells.forEach((cell) => {
      const style = getStyle(cell.status)
      
      const polygon = new AMap.Polygon({
        path: cell.coordinates,
        ...style,
        bubble: false, // Stop event propagation if needed, but 'false' usually means it consumes the event
        cursor: 'pointer',
        extData: cell, // Store cell data for event handlers
      })

      // Hover effects
      polygon.on("mouseover", () => {
        if (cell.status !== 'fog') {
          polygon.setOptions({
            fillOpacity: style.fillOpacity + 0.2,
            strokeOpacity: 1,
          })
        }
      })

      polygon.on("mouseout", () => {
        if (cell.status !== 'fog') {
          polygon.setOptions(style)
        }
      })

      // Click handler
      polygon.on("click", (e: any) => {
        // Prevent map click if necessary, though AMap handles overlay clicks separately usually
        onCellClick(cell)
      })

      newPolygons.push(polygon)
    })

    // Add all polygons to map
    map.add(newPolygons)
    polygonsRef.current = newPolygons

    // Cleanup
    return () => {
      try {
        if (map && polygonsRef.current.length) {
          map.remove(polygonsRef.current)
          polygonsRef.current = []
        }
      } catch (error) {
        console.warn('Failed to remove polygons:', error);
      }
    }
  }, [map, AMap, cells]) // Re-run if cells change

  return null // This component renders nothing to the DOM, only to the Map canvas
}
