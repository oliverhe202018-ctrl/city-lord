"use client";

import { useEffect, useState, useCallback, useRef } from "react";

// TODO: Fetch real territories from API/Context
const territories: Territory[] = [];

interface Territory {
  id: string;
  path: [number, number][];
}

interface FogLayerProps {
  map: any | null;
}

// 全球外环坐标（覆盖整个地球）
const GLOBAL_OUTER_RING: [number, number][] = [
  [-179.9, 89.9],  // 西北
  [-179.9, -89.9], // 西南  
  [179.9, -89.9],  // 东南
  [179.9, 89.9],   // 东北
];

// 检查点是否在视口内
const isPointInBounds = (point: [number, number], bounds: any): boolean => {
  const lng = point[0];
  const lat = point[1];
  return lng >= bounds.getSouthWest().getLng() && 
         lng <= bounds.getNorthEast().getLng() && 
         lat >= bounds.getSouthWest().getLat() && 
         lat <= bounds.getNorthEast().getLat();
};

// 检查领土是否与视口相交
const isTerritoryInViewport = (territory: Territory, bounds: any): boolean => {
  // 简单检查：只要领土的任意一个点在视口内就认为相交
  return territory.path.some(point => isPointInBounds(point, bounds));
};

const FogLayer: React.FC<FogLayerProps> = ({ map }) => {
  const fogPolygonRef = useRef<any | null>(null);

  const updateFog = useCallback(() => {
    if (!map) return;

    try {
      // Check if map is destroyed or invalid
      // AMap doesn't have a standard public isDestroyed check, but checking for getBounds usually works
      // or checking internal properties if known. 
      // For safety, we wrap in try-catch.
      if (typeof map.getBounds !== 'function') return;

      const bounds = map.getBounds();
      if (!bounds) return;

      // 获取需要挖洞的领土（视口内或全部，取决于数量）
      let territoriesToShow: Territory[];

      if (territories.length > 300) {
        // 性能优化：只显示视口内的领土
        territoriesToShow = territories.filter(t => isTerritoryInViewport(t, bounds));
      } else {
        // 领土数量较少时显示全部
        territoriesToShow = territories;
      }

      // 构建多环路径：外环 + 内环（洞）
      const path = [GLOBAL_OUTER_RING, ...territoriesToShow.map(t => t.path)];

      if (fogPolygonRef.current) {
        // 更新现有雾层
        fogPolygonRef.current.setPath(path as any);
      } else {
        // 创建新的雾层
        if (!(window as any).AMap) return;
        
        const newFogPolygon = new (window as any).AMap.Polygon({
          path: path,
          fillColor: "#000000",      // 黑色雾层
          fillOpacity: 0.4,          // 降低透明度以便在手机上可见地图内容
          strokeWeight: 0,            // 无边框
          strokeColor: "transparent",
          bubble: true,               // 允许事件穿透
          zIndex: 100,                // 确保在底图之上
        });

        fogPolygonRef.current = newFogPolygon;
        map.add(newFogPolygon);
      }
    } catch (error) {
      console.warn('Error updating FogLayer:', error);
    }
  }, [map]);

  useEffect(() => {
    if (!map) return;

    // 初始化雾层
    updateFog();

    // 监听地图移动和缩放事件
    map.on("moveend", updateFog);
    map.on("zoomend", updateFog);

    return () => {
      try {
        if (map) {
          // Check if map methods exist before calling
          if (typeof map.off === 'function') {
            map.off("moveend", updateFog);
            map.off("zoomend", updateFog);
          }
          
          if (fogPolygonRef.current) {
            try {
              // Priority 1: Object self-remove (User suggested fix)
              if (typeof fogPolygonRef.current.remove === 'function') {
                 fogPolygonRef.current.remove();
              } 
              // Priority 2: Map remove fallback
              else if (map && typeof map.remove === 'function') {
                map.remove(fogPolygonRef.current);
              }
              
              fogPolygonRef.current = null;
            } catch (error) {
              console.warn('Failed to remove fogPolygon:', error);
            }
          }
        }
      } catch (error) {
        console.warn('Failed to cleanup FogLayer:', error);
      }
    };
  }, [map, updateFog]);

  // 监听领土数据变化（如果领土数据会动态更新）
  useEffect(() => {
    updateFog();
  }, [territories, updateFog]);

  return null;
};

export default FogLayer;