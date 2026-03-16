"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { ExtTerritory } from "@/types/city";
import { useCity } from "@/contexts/CityContext";
import { useMapInteraction } from "./MapInteractionContext";
import { generateTerritoryStyle } from "@/lib/citylord/territory-renderer";
import { ViewContext } from "@/types/city";
import { useAuth } from "@/hooks/useAuth";
import * as turf from '@turf/turf';

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
  kingdomMode?: 'personal' | 'club';
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
const DEBUG_FORCE_H3_FALLBACK = false; // 临时 debug 常量，已废弃

const TerritoryLayer: React.FC<TerritoryLayerProps> = ({ map, isVisible, kingdomMode }) => {
  const [polygons, setPolygons] = useState<any[]>([]);
  const [markers, setMarkers] = useState<any[]>([]);
  const { currentCity: city } = useCity();
  const { viewMode, selectedTerritory, setSelectedTerritory, setIsDetailSheetOpen } = useMapInteraction();
  const { user } = useAuth();

  // Track polygon → territory mapping for highlight updates
  const polygonTerritoryMap = useRef<Map<any, { territory: ExtTerritory; defaultStrokeColor: string }>>(new Map());

  // 用于 hover handler 中获取最新的 selectedTerritory，避免 stale closure
  const selectedTerritoryRef = useRef<ExtTerritory | null | undefined>(selectedTerritory);
  useEffect(() => {
    selectedTerritoryRef.current = selectedTerritory;
  }, [selectedTerritory]);

  // Fallback Map
  const activeTerritoryMap = useRef<Map<string, ExtTerritory>>(new Map());

  // 防止 map click 在 polygon click 之后立即清除选择（机制已移出到 AMapView Root Layer）
  const territoryClickedRef = useRef(false);

  // 受控的 ContextSwitch 拦截器：确保真正的语义变更才触发清空
  const prevContextRef = useRef({ cityId: city?.id, viewMode, kingdomMode });
  useEffect(() => {
    const prev = prevContextRef.current;
    
    // 只在非初始挂载（即至少有一个已缓存），且确实发生了严格变化时，才清空选中
    // 这里略过了对尚未设置 city 的极初期过滤
    const isChanged = 
      (city?.id !== undefined && city?.id !== prev.cityId) || 
      (viewMode !== undefined && viewMode !== prev.viewMode) || 
      (kingdomMode !== undefined && kingdomMode !== prev.kingdomMode);

    if (isChanged) {
      console.log(`[Audit] ContextSwitch clear: city ${prev.cityId}->${city?.id} viewMode ${prev.viewMode}->${viewMode} kingdomMode ${prev.kingdomMode}->${kingdomMode}`);
      setSelectedTerritory?.(null);
    }
    
    // 永远同步最新 ref
    prevContextRef.current = { cityId: city?.id, viewMode, kingdomMode };
  }, [city, viewMode, kingdomMode, setSelectedTerritory]);

  // Load territories
  useEffect(() => {
    if (!map || !city) return;

    let mounted = true;

    const loadTerritories = async () => {
      try {
        console.log(`[Audit] loadTerritories: cityId=${city.id} map=${!!map}`);
        const data = await fetchTerritories(city.id);
        console.log(`[Audit] loadTerritories: API returned ${Array.isArray(data) ? data.length : 'non-array'} items`);

        if (!mounted) return;

        const newPolygonMap = new Map<any, { territory: ExtTerritory; defaultStrokeColor: string }>();
        const newCellMap = new Map<string, ExtTerritory>(); // Prepare fallback map

        const createdPolygons = (Array.isArray(data) ? data : []).map((territory) => {
          // Populate fallback dictionary
          newCellMap.set(territory.id, territory);

          // Extract path from geojson
          let path: [number, number][] = [];
          
          if (territory.geojson_json && territory.geojson_json.coordinates) {
             // We enforce Option A: Backend always returns single Polygons.
             if (territory.geojson_json.type === 'Polygon') {
               path = territory.geojson_json.coordinates[0];
             } else {
               console.warn(`[TerritoryLayer] Unsupported or invalid geometry type for territory ${territory.id}: ${territory.geojson_json.type}. Check settlement backend split logic.`);
               return null;
             }
          }
          
          // Safeguard: if parsing failed, fallback or skip
          if (!path || path.length < 3) return null;

          const ctx: ViewContext = {
            userId: user?.id || null,
            subject: kingdomMode === 'club' ? 'club' : (viewMode === 'faction' ? 'faction' : 'individual')
          };
          const style = generateTerritoryStyle(territory, ctx);

          // 俱乐部模式下降低多边形填充透明度，以突出头像 Marker
          const polygonFillOpacity = kingdomMode === 'club' ? 0.15 : 0.5;

          const polygon = new (window as any).AMap.Polygon({
            path: path,
            fillColor: style.fillColor2D,
            fillOpacity: polygonFillOpacity,
            strokeColor: style.strokeColor2D,
            strokeWeight: 2,
            zIndex: 50,
            extData: territory,
            bubble: false, // 阻止事件冒泡到地图，避免 blank click 误触发
          });

          // Store mapping for highlight management
          newPolygonMap.set(polygon, {
            territory,
            defaultStrokeColor: style.strokeColor2D,
          });

          let marker = null;
          if (kingdomMode === 'club' && territory.ownerClub) {
            // 使用 turf.pointOnFeature 确保标注点在多边形内部（非凸多边形的 centroid 可能落在外面）
            let markerPosition: [number, number];
            try {
              const coords = path.map((p: any) => [p[0], p[1]]);
              // 确保闭合
              if (coords.length > 0 && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
                coords.push(coords[0]);
              }
              const poly = turf.polygon([coords]);
              const pt = turf.pointOnFeature(poly);
              markerPosition = pt.geometry.coordinates as [number, number];
            } catch {
              // 回退到 BBox 中心
              const center = polygon.getBounds().getCenter();
              markerPosition = [center.getLng(), center.getLat()];
            }
            
            // 基础尺寸 24px，会被 zoomchange 事件动态调整
            const baseSize = 24;
            const content = document.createElement('div');
            content.className = 'pointer-events-none';
            content.style.width = `${baseSize}px`;
            content.style.height = `${baseSize}px`;
            content.style.marginLeft = `-${baseSize / 2}px`;
            content.style.marginTop = `-${baseSize / 2}px`;

            const inner = document.createElement('div');
            inner.className = 'w-full h-full rounded-full overflow-hidden border border-white bg-black/60 shadow flex items-center justify-center';
            
            if (territory.ownerClub.logoUrl) {
              const img = document.createElement('img');
              img.src = territory.ownerClub.logoUrl;
              img.className = 'w-full h-full object-cover';
              inner.appendChild(img);
            } else {
              const span = document.createElement('span');
              span.className = 'text-[10px] text-white font-bold leading-none';
              span.innerText = territory.ownerClub.name.substring(0, 1);
              inner.appendChild(span);
            }
            content.appendChild(inner);

            marker = new (window as any).AMap.Marker({
              position: markerPosition,
              content: content,
              zIndex: 60,
              bubble: true,
              zooms: [12, 20], // zoom < 12 时隐藏头像
            });

            // 缓存 DOM 引用用于缩放回调
            (marker as any).__avatarContentEl = content;
          }

          // 点击 Polygon 时同时打开 InfoBar 和 DetailSheet 抽屉
          polygon.on("click", (e: any) => {
            console.log(`[Audit] ★ POLYGON CLICK ★ territory=${territory.id}`);
            (window as any).__amap_polygon_clicked = Date.now();
            setSelectedTerritory?.(territory);
            setIsDetailSheetOpen?.(true);
          });
          polygon.on("mouseover", () => {
            // 使用 ref 获取最新的 selectedTerritory，避免 stale closure
            if (selectedTerritoryRef.current?.id !== territory.id) {
              polygon.setOptions({ strokeWeight: 3 });
            }
          });
          polygon.on("mouseout", () => {
            if (selectedTerritoryRef.current?.id !== territory.id) {
              polygon.setOptions({ strokeWeight: 2 });
            }
          });

          return { polygon, marker };
        });

        polygonTerritoryMap.current = newPolygonMap;
        activeTerritoryMap.current = newCellMap;
        console.log(`[Audit] Territory lookup table built: ${newCellMap.size} entries`);

        // Clear old polygons before adding new ones
        setPolygons(prev => {
          prev.forEach(p => {
            if (p && typeof p.setMap === 'function') {
              p.setMap(null);
            }
          });
          const validPolygons = createdPolygons.filter(item => item !== null).map(item => item!.polygon).filter(p => !!p);
          map.add(validPolygons);
          return validPolygons;
        });

        setMarkers(prev => {
          prev.forEach(m => {
            if (m && typeof m.setMap === 'function') {
              m.setMap(null);
            }
          });
          const validMarkers = createdPolygons.filter(item => item !== null).map(item => item!.marker).filter(m => !!m);
          map.add(validMarkers);
          return validMarkers;
        });

      } catch (error: any) {
        if (error?.name !== 'AbortError' && error?.digest !== 'NEXT_REDIRECT') {
          console.error("Failed to load territories:", error);
        }
      }
    };

    loadTerritories();

    const handleRefresh = () => {
      console.log(`[Audit] Manual refresh triggered via event`);
      loadTerritories();
    };
    window.addEventListener('citylord:refresh-territories', handleRefresh);

    return () => {
      mounted = false;
      window.removeEventListener('citylord:refresh-territories', handleRefresh);
    };
  // 加入 user?.id 确保认证状态变化后 polygon 重建，以获得正确的 self/enemy 样式
  }, [map, city, viewMode, kingdomMode, user?.id]);

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

  // 俱乐部 Marker 头像随 zoom 级别动态缩放
  useEffect(() => {
    if (!map || kingdomMode !== 'club' || markers.length === 0) return;

    const MIN_ZOOM = 12;
    const MAX_ZOOM = 18;
    const MIN_SIZE = 16;   // px
    const MAX_SIZE = 64;   // px

    const updateMarkerSizes = () => {
      const zoom = map.getZoom();
      // 线性映射 [MIN_ZOOM, MAX_ZOOM] → [MIN_SIZE, MAX_SIZE]
      const t = Math.max(0, Math.min(1, (zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)));
      const size = Math.round(MIN_SIZE + t * (MAX_SIZE - MIN_SIZE));

      markers.forEach((m: any) => {
        const el = m.__avatarContentEl;
        if (el) {
          el.style.width = `${size}px`;
          el.style.height = `${size}px`;
          el.style.marginLeft = `-${size / 2}px`;
          el.style.marginTop = `-${size / 2}px`;
        }
      });
    };

    // 初始化一次
    updateMarkerSizes();
    map.on('zoomchange', updateMarkerSizes);
    return () => { map.off('zoomchange', updateMarkerSizes); };
  }, [map, markers, kingdomMode]);
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
        if (map && markers.length > 0) {
          markers.forEach(m => {
            if (m && typeof m.setMap === 'function') {
              m.setMap(null);
            }
          });
          if (typeof map?.remove === 'function') {
            map.remove(markers.filter((m: any) => !!m));
          }
        }
      } catch (error) {
        console.warn('Failed to remove polygons or markers:', error);
      }
    };
  }, [polygons, markers, map]);

  // Visibility toggle
  useEffect(() => {
    if (isVisible) {
      polygons.forEach((p) => p.show());
      markers.forEach((m) => m.show());
    } else {
      polygons.forEach((p) => p.hide());
      markers.forEach((m) => m.hide());
    }
  }, [isVisible, polygons, markers]);

  return null;
};

export default TerritoryLayer;
