"use client";

import { useEffect, useState } from "react";
import { Territory } from "@/types/city";
import { fetchTerritories } from "@/app/actions/city";
import { useCity } from "@/contexts/CityContext";
import { cellToBoundary } from "h3-js";

interface TerritoryLayerProps {
  map: any | null;
  isVisible: boolean;
  onTerritoryClick: (territory: Territory) => void;
}

const getTerritoryStyle = (ownerType: 'me' | 'enemy' | 'neutral') => {
  switch (ownerType) {
    case "me":
      return { fillColor: "#22c55e", strokeColor: "#16a34a", opacity: 0.5 };
    case "enemy":
      return { fillColor: "#a855f7", strokeColor: "#9333ea", opacity: 0.5 };
    case "neutral":
      return { fillColor: "#f59e0b", strokeColor: "#d97706", opacity: 0.5 };
  }
};

const TerritoryLayer: React.FC<TerritoryLayerProps> = ({ map, isVisible, onTerritoryClick }) => {
  const [polygons, setPolygons] = useState<any[]>([]);
  const { currentCity: city } = useCity();

  useEffect(() => {
    if (!map || !city) return;

    let mounted = true;

    const loadTerritories = async () => {
      try {
        const data = await fetchTerritories(city.id);
        
        if (!mounted) return;

        const createdPolygons = data.map((territory) => {
          // Convert H3 index to polygon coordinates
          // h3-js returns [lat, lng], AMap expects [lng, lat]
          const boundary = cellToBoundary(territory.id);
          const path = boundary.map(([lat, lng]) => [lng, lat]);

          const style = getTerritoryStyle(territory.ownerType);
          const polygon = new (window as any).AMap.Polygon({
            path: path,
            fillColor: style.fillColor,
            fillOpacity: style.opacity,
            strokeColor: style.strokeColor,
            strokeWeight: 2,
            zIndex: 50, // Ensure territories are above the base map
            extData: territory // Store territory data for click handler
          });

          polygon.on("click", () => onTerritoryClick(territory));
          polygon.on("mouseover", () => polygon.setOptions({ strokeWeight: 4 }));
          polygon.on("mouseout", () => polygon.setOptions({ strokeWeight: 2 }));

          return polygon;
        });

        // Clear old polygons before adding new ones
        setPolygons(prev => {
           prev.forEach(p => p.setMap(null)); 
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
  }, [map, city, onTerritoryClick]);

  // Cleanup polygons when component unmounts or they change
  useEffect(() => {
    return () => {
      try {
        if (map && polygons.length > 0) {
          map.remove(polygons);
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
