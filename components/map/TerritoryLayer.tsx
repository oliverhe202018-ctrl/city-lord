"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { ExtTerritory } from "@/types/city";
import { useCity } from "@/contexts/CityContext";
import { cellToBoundary } from "h3-js";
import { useMap } from "./AMapContext";
import { generateTerritoryStyle } from "@/lib/citylord/territory-renderer";
import { ViewContext } from "@/types/city";
import { useAuth } from "@/hooks/useAuth";

const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit, timeoutMs = 15000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let url = input
    if (typeof url === 'string' && url.startsWith('/api')) {
      url = `${process.env.NEXT_PUBLIC_API_SERVER || ''}${url}`
    }
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const fetchTerritories = async (cityId: string): Promise<ExtTerritory[]> => {
  const res = await fetchWithTimeout(`/api/city/fetch-territories?cityId=${cityId}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch territories')
  return await res.json()
}

/**
 * Darken a hex color by a factor (0-1, where 0.7 = 30% darker)
 */
function darkenColor(hex: string, factor: number = 0.6): string {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const r = Math.round(parseInt(hex.substring(0, 2), 16) * factor);
  const g = Math.round(parseInt(hex.substring(2, 4), 16) * factor);
  const b = Math.round(parseInt(hex.substring(4, 6), 16) * factor);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

interface TerritoryLayerProps {
  map: any | null;
  isVisible: boolean;
}

/**
 * TerritoryLayer: Renders ALL territories from API as colored polygons.
 *
 * Features:
 * - Fetches all territories for the current city
 * - Colors by ownership (self/enemy/neutral) via territory-renderer
 * - Click handler selects a territory → updates selectedTerritory in context
 * - Selected territory gets a persistent darker border highlight
 * - Map blank click clears selection (with event conflict protection)
 */
const TerritoryLayer: React.FC<TerritoryLayerProps> = ({ map, isVisible }) => {
  const [polygons, setPolygons] = useState<any[]>([]);
  const { currentCity: city } = useCity();
  const { viewMode, selectedTerritory, setSelectedTerritory } = useMap();
  const { user } = useAuth();

  // Track polygon → territory mapping for highlight updates
  const polygonTerritoryMap = useRef<Map<any, { territory: ExtTerritory; defaultStrokeColor: string }>>(new Map());

  // Flag to prevent map click from clearing territory selection immediately after polygon click
  const territoryClickedRef = useRef(false);

  // Handle map blank click → clear selection (with event conflict protection)
  useEffect(() => {
    if (!map) return;

    const handleMapClick = () => {
      // If a polygon was just clicked, skip this map click
      if (territoryClickedRef.current) {
        territoryClickedRef.current = false;
        return;
      }
      // Clear selection on blank area click
      setSelectedTerritory?.(null);
    };

    map.on('click', handleMapClick);
    return () => {
      if (map?.off) {
        map.off('click', handleMapClick);
      }
    };
  }, [map, setSelectedTerritory]);

  // Clear selection when viewMode changes
  useEffect(() => {
    setSelectedTerritory?.(null);
  }, [viewMode, setSelectedTerritory]);

  // Load territories
  useEffect(() => {
    if (!map || !city) return;

    let mounted = true;

    const loadTerritories = async () => {
      try {
        const data = await fetchTerritories(city.id);

        if (!mounted) return;

        const newPolygonMap = new Map<any, { territory: ExtTerritory; defaultStrokeColor: string }>();

        const createdPolygons = (Array.isArray(data) ? data : []).map((territory) => {
          // Convert H3 index to polygon coordinates
          // h3-js returns [lat, lng], AMap expects [lng, lat]
          const boundary = cellToBoundary(territory.id);
          const path = boundary.map(([lat, lng]) => [lng, lat]);

          const ctx: ViewContext = {
            userId: user?.id || null,
            subject: viewMode === 'faction' ? 'faction' : 'individual'
          };
          const style = generateTerritoryStyle(territory, ctx);

          const polygon = new (window as any).AMap.Polygon({
            path: path,
            fillColor: style.fillColor2D,
            fillOpacity: 0.5,
            strokeColor: style.strokeColor2D,
            strokeWeight: 2,
            zIndex: 50,
            extData: territory,
            bubble: false, // Prevent click event from bubbling to map
          });

          // Store mapping for highlight management
          newPolygonMap.set(polygon, {
            territory,
            defaultStrokeColor: style.strokeColor2D,
          });

          polygon.on("click", () => {
            // Set flag to prevent map blank click from clearing immediately
            territoryClickedRef.current = true;
            setSelectedTerritory?.(territory);
          });
          polygon.on("mouseover", () => {
            // Only apply hover effect if not the selected polygon
            if (selectedTerritory?.id !== territory.id) {
              polygon.setOptions({ strokeWeight: 3 });
            }
          });
          polygon.on("mouseout", () => {
            if (selectedTerritory?.id !== territory.id) {
              polygon.setOptions({ strokeWeight: 2 });
            }
          });

          return polygon;
        });

        polygonTerritoryMap.current = newPolygonMap;

        // Clear old polygons before adding new ones
        setPolygons(prev => {
          prev.forEach(p => {
            if (p && typeof p.setMap === 'function') {
              p.setMap(null);
            }
          });
          return createdPolygons;
        });

        map.add(createdPolygons);

      } catch (error: any) {
        if (error?.name !== 'AbortError' && error?.digest !== 'NEXT_REDIRECT') {
          console.error("Failed to load territories:", error);
        }
      }
    };

    loadTerritories();

    return () => {
      mounted = false;
    };
  }, [map, city, viewMode]);

  // Apply selection highlight when selectedTerritory changes
  useEffect(() => {
    polygonTerritoryMap.current.forEach(({ territory, defaultStrokeColor }, polygon) => {
      if (selectedTerritory && territory.id === selectedTerritory.id) {
        // Highlight: darker border, thicker stroke
        polygon.setOptions({
          strokeWeight: 5,
          strokeColor: darkenColor(defaultStrokeColor, 0.5),
          strokeStyle: 'solid',
        });
      } else {
        // Reset to default
        polygon.setOptions({
          strokeWeight: 2,
          strokeColor: defaultStrokeColor,
          strokeStyle: 'solid',
        });
      }
    });
  }, [selectedTerritory]);

  // Cleanup polygons when component unmounts or they change
  useEffect(() => {
    return () => {
      try {
        if (map && polygons.length > 0) {
          polygons.forEach(p => {
            if (p && typeof p.setMap === 'function') {
              p.setMap(null);
            }
          });
          if (typeof map?.remove === 'function') {
            map.remove(polygons.filter((p: any) => !!p));
          }
        }
      } catch (error) {
        console.warn('Failed to remove polygons:', error);
      }
    };
  }, [polygons, map]);

  // Visibility toggle
  useEffect(() => {
    if (isVisible) {
      polygons.forEach((p) => p.show());
    } else {
      polygons.forEach((p) => p.hide());
    }
  }, [isVisible, polygons]);

  return null;
};

export default TerritoryLayer;
