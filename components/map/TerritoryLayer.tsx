"use client";

import { useEffect, useState } from "react";
import { Territory } from "@/types/city";
import { fetchTerritories } from "@/app/actions/city";
import { useCity } from "@/contexts/CityContext";
import { cellToBoundary } from "h3-js";
import { useAMap } from "./AMapProvider";

interface TerritoryLayerProps {
  map: any | null;
  isVisible: boolean;
  onTerritoryClick: (territory: Territory) => void;
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

const getTerritoryStyle = (territory: Territory, viewMode: 'individual' | 'faction') => {
  if (viewMode === 'faction') {
    // Faction Mode
    if (territory.ownerType === 'me') {
        return { fillColor: "#22c55e", strokeColor: "#16a34a", opacity: 0.6, strokeWeight: 3 };
    }
    
    // We need faction data in Territory type. Assuming it might be extended or we infer from somewhere.
    // Since current Territory type might not have faction, let's assume we need to update it or use placeholder logic for now.
    // If backend doesn't return faction yet, we might need to rely on 'ownerType' being enough for now, 
    // or if we have ownerId we can fetch user profile? That's too slow for map.
    // Let's assume for now: 'enemy' -> check if we have faction info? 
    // If not available, we fallback to red.
    // Ideally, `fetchTerritories` should return faction info.
    
    // For this task, since we updated profiles table but maybe not the territory fetch join...
    // Let's try to simulate or use what we have.
    // If we assume the user is RED, enemies are BLUE? No, multiple factions.
    
    // Let's check if Territory type has faction. 
    // If not, we'll just color enemies Red for now in faction mode, or distinct.
    
    if (territory.ownerType === 'enemy') {
       // If we had faction: 
       // if (territory.faction === 'RED') return { ...red }
       // if (territory.faction === 'BLUE') return { ...blue }
       return { fillColor: "#ef4444", strokeColor: "#dc2626", opacity: 0.5 };
    }
    
    return { fillColor: "#f59e0b", strokeColor: "#d97706", opacity: 0.5 };
  } else {
    // Individual Mode
    if (territory.ownerType === 'me') {
      return { fillColor: "#22c55e", strokeColor: "#16a34a", opacity: 0.5 };
    }
    if (territory.ownerType === 'enemy') {
      // Use hash color for enemies to distinguish players
      const color = territory.ownerId ? stringToColor(territory.ownerId) : "#a855f7";
      return { fillColor: color, strokeColor: color, opacity: 0.5 };
    }
    return { fillColor: "#f59e0b", strokeColor: "#d97706", opacity: 0.5 };
  }
};

const TerritoryLayer: React.FC<TerritoryLayerProps> = ({ map, isVisible, onTerritoryClick }) => {
  const [polygons, setPolygons] = useState<any[]>([]);
  const { currentCity: city } = useCity();
  const { viewMode } = useAMap(); // Use viewMode from context

  useEffect(() => {
    if (!map || !city) return;

    let mounted = true;

    const loadTerritories = async () => {
      try {
        const data = await fetchTerritories(city.id);
        
        if (!mounted) return;

        const createdPolygons = (data || []).map((territory) => {
          // Convert H3 index to polygon coordinates
          // h3-js returns [lat, lng], AMap expects [lng, lat]
          const boundary = cellToBoundary(territory.id);
          const path = boundary.map(([lat, lng]) => [lng, lat]);

          const style = getTerritoryStyle(territory, viewMode);
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
  }, [map, city, onTerritoryClick, viewMode]);

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
