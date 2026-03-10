"use client";

import { useEffect, useState } from "react";
import type { Territory, ExtTerritory } from "@/types/city";
import { useCity } from "@/contexts/CityContext";

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
import { cellToBoundary } from "h3-js";
import { useMap } from "./AMapContext";

interface TerritoryLayerProps {
  map: any | null;
  isVisible: boolean;
  onTerritoryClick: (territory: ExtTerritory) => void;
}

// Deterministic color generator based on string
import { generateTerritoryStyle } from "@/lib/citylord/territory-renderer";
import { ViewContext } from "@/types/city";

const TerritoryLayer: React.FC<TerritoryLayerProps> = ({ map, isVisible, onTerritoryClick }) => {
  const [polygons, setPolygons] = useState<any[]>([]);
  const { currentCity: city } = useCity();
  const { viewMode } = useMap(); // Use viewMode from context

  useEffect(() => {
    if (!map || !city) return;

    let mounted = true;

    const loadTerritories = async () => {
      try {
        const data = await fetchTerritories(city.id);

        if (!mounted) return;

        const createdPolygons = (Array.isArray(data) ? data : []).map((territory) => {
          // Convert H3 index to polygon coordinates
          // h3-js returns [lat, lng], AMap expects [lng, lat]
          const boundary = cellToBoundary(territory.id);
          const path = boundary.map(([lat, lng]) => [lng, lat]);

          const ctx: ViewContext = {
            userId: city.userId || null,
            subject: viewMode === 'faction' ? 'faction' : 'individual' // Note: club mode not hooked up yet
          };
          const style = generateTerritoryStyle(territory, ctx);

          const polygon = new (window as any).AMap.Polygon({
            path: path,
            fillColor: style.fillColor2D,
            fillOpacity: 0.5,
            strokeColor: style.strokeColor2D,
            strokeWeight: 2,
            zIndex: 50,
            extData: territory
          });

          polygon.on("click", () => onTerritoryClick(territory));
          polygon.on("mouseover", () => polygon.setOptions({ strokeWeight: 4 }));
          polygon.on("mouseout", () => polygon.setOptions({ strokeWeight: 2 }));

          return polygon;
        });

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
      // Cleanup happens in the effect that watches 'polygons' or here if needed
      // But since we setPolygons, we can rely on the cleanup logic below? 
      // Actually, we should clean up the newly created ones if unmounted quickly.
      // But standard React pattern: the next render or unmount will clean up `polygons` via the other effect?
      // No, the other effect only toggles visibility. We need cleanup here.
    };
  }, [map, city, onTerritoryClick, viewMode]);

  // Cleanup polygons when component unmounts or they change
  useEffect(() => {
    return () => {
      try {
        if (map && polygons.length > 0) {
          // map.remove(polygons) is standard, but defensive coding:
          polygons.forEach(p => {
            if (p && typeof p.setMap === 'function') {
              p.setMap(null); // Safer than map.remove([p]) sometimes
            }
          });
          if (typeof map?.remove === 'function') {
            map.remove(polygons.filter(p => !!p));
          }
        }
      } catch (error) {
        console.warn('Failed to remove polygons:', error);
      }
    };
  }, [polygons, map]);

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
