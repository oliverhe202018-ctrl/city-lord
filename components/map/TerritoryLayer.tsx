"use client";

import { useEffect, useState } from "react";
import { territories, Territory, OwnerType } from "@/lib/mock-data";

interface TerritoryLayerProps {
  map: any | null;
  isVisible: boolean;
  onTerritoryClick: (territory: Territory) => void;
}

const getTerritoryStyle = (ownerType: OwnerType) => {
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

  useEffect(() => {
    if (!map) return;

    const createdPolygons = territories.map((territory) => {
      const style = getTerritoryStyle(territory.ownerType);
      const polygon = new (window as any).AMap.Polygon({
        path: territory.path,
        fillColor: style.fillColor,
        fillOpacity: style.opacity,
        strokeColor: style.strokeColor,
        strokeWeight: 2,
        zIndex: 50, // Ensure territories are above the base map
      });

      polygon.on("click", () => onTerritoryClick(territory));
      polygon.on("mouseover", () => polygon.setOptions({ strokeWeight: 4 }));
      polygon.on("mouseout", () => polygon.setOptions({ strokeWeight: 2 }));

      return polygon;
    });

    setPolygons(createdPolygons);
    map.add(createdPolygons);

    return () => {
      // 使用 try-catch 防止在 map 已经销毁时报错
      try {
        if (map && createdPolygons && createdPolygons.length > 0) {
          map.remove(createdPolygons);
        }
      } catch (error) {
        console.warn('Failed to remove polygons:', error);
      }
    };
  }, [map, onTerritoryClick]);

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
