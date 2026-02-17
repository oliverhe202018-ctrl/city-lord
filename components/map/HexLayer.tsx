"use client"

import { useEffect, useRef } from "react"
import { useMap } from "./MapContext"
import { HexCellData } from "./HexDetailSheet"

interface HexLayerProps {
  cells: HexCellData[]
  onCellClick: (cell: HexCellData) => void
}

// Deterministic color generator based on string
const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
}

export function HexLayer({ cells, onCellClick }: HexLayerProps) {
  const { map, AMap, viewMode } = useMap()
  const polygonsRef = useRef<any[]>([])

  // Style config
  const getStyle = (cell: HexCellData) => {
    // Faction Mode
    if (viewMode === 'faction') {
      if (cell.status === 'owned') {
        // My tiles in faction mode - distinct highlight
        return {
          strokeColor: "#ffffff",
          fillColor: "#22c55e", // Keep green for self
          fillOpacity: 0.6,
          strokeOpacity: 1,
          strokeWeight: 3,
        }
      }

      if (cell.faction === 'RED') {
        return {
          strokeColor: "#ef4444",
          fillColor: "#ef4444",
          fillOpacity: 0.4,
          strokeOpacity: 0.8,
          strokeWeight: 1,
        }
      } else if (cell.faction === 'BLUE') {
        return {
          strokeColor: "#3b82f6",
          fillColor: "#3b82f6",
          fillOpacity: 0.4,
          strokeOpacity: 0.8,
          strokeWeight: 1,
        }
      } else {
        // Neutral/Unknown
        return {
          strokeColor: "#94a3b8",
          fillColor: "#94a3b8",
          fillOpacity: 0.1,
          strokeOpacity: 0.3,
          strokeWeight: 1,
        }
      }
    }

    // Individual Mode (Default)
    switch (cell.status) {
      case "owned":
        return {
          strokeColor: "#22c55e", // Green
          fillColor: "#22c55e",
          fillOpacity: 0.3,
          strokeOpacity: 0.8,
          strokeWeight: 2,
        }
      case "enemy":
        // Generate color from owner_id if available, else red
        const color = cell.ownerId ? stringToColor(cell.ownerId) : "#ef4444";
        return {
          strokeColor: color,
          fillColor: color,
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
      map?.remove?.(polygonsRef.current)
      polygonsRef.current = []
    }

    // ...

    const newPolygons: any[] = []

    cells.forEach((cell) => {
      const style = getStyle(cell)

      const polygon = new AMap.Polygon({
        path: cell.coordinates,
        ...style,
        bubble: false,
        cursor: 'pointer',
        extData: cell,
      })
      // ...
      newPolygons.push(polygon);

      // Hover effects
      polygon.on("mouseover", () => {
        // ... existing logic ...
        // For now just keep it simple or reimplement hover
        polygon.setOptions({ fillOpacity: (style.fillOpacity || 0.3) + 0.2 })
      })
      polygon.on("mouseout", () => {
        polygon.setOptions({ fillOpacity: style.fillOpacity })
      })
      polygon.on("click", () => {
        onCellClick(cell)
      })
    })

    map.add(newPolygons)
    polygonsRef.current = newPolygons

    return () => {
      try {
        if (map && polygonsRef.current.length) {
          const validPolygons = polygonsRef.current.filter(p => !!p)
          if (validPolygons.length > 0) {
            if (typeof map.remove === 'function') {
              map.remove(validPolygons)
            } else {
              validPolygons.forEach(p => {
                if (p && typeof p.setMap === 'function') p.setMap(null)
              })
            }
          }
          polygonsRef.current = []
        }
      } catch (error) {
        console.warn('Failed to remove polygons:', error)
      }
    }
  }, [map, AMap, cells, viewMode]) // Re-render when viewMode changes

  return null
}
