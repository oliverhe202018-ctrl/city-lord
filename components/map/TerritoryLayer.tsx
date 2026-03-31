"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { logEvent } from '@/lib/native-log';
import type { ExtTerritory } from "@/types/city";
import { useCity } from "@/contexts/CityContext";
import { useMapInteraction } from "./MapInteractionContext";
import { calculateHealthVisuals, generateTerritoryStyle } from "@/lib/citylord/territory-renderer";
import { ViewContext } from "@/types/city";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import type { ViewportKingData } from "./AMapView";
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
  showFactionColors?: boolean;
  onViewportKingChange?: (king: ViewportKingData | null) => void;
}

interface OwnerProfile {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
}

interface TerritoryMetric {
  ownerId: string;
  area: number;
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

/**
 * TerritoryLayer: Renders ALL territories from API as colored polygons.
 *
 * Features:
 * - Fetches all territories for the current city
 * - Colors by ownership (self/enemy/neutral) via territory-renderer
 * - Click handler selects a territory 鈫?updates selectedTerritory in context
 * - Selected territory gets a persistent darker border highlight
 * - Map blank click clears selection (with event conflict protection)
 */
const DEBUG_FORCE_H3_FALLBACK = false; // 涓存椂 debug 甯搁噺锛屽凡搴熷純

const TerritoryLayer: React.FC<TerritoryLayerProps> = ({ map, isVisible, kingdomMode, showFactionColors = false, onViewportKingChange }) => {
  const [polygons, setPolygons] = useState<any[]>([]);
  const [markers, setMarkers] = useState<any[]>([]);
  const { currentCity: city } = useCity();
  const { viewMode, selectedTerritory, setSelectedTerritory, setIsDetailSheetOpen, openTerritoryDetailDrawer } = useMapInteraction();
  const { user } = useAuth();

  // Track polygon 鈫?territory mapping for highlight updates
  const polygonTerritoryMap = useRef<Map<any, { territory: ExtTerritory; defaultStrokeColor: string }>>(new Map());

  // 鐢ㄤ簬 hover handler 涓幏鍙栨渶鏂扮殑 selectedTerritory锛岄伩鍏?stale closure
  const selectedTerritoryRef = useRef<ExtTerritory | null | undefined>(selectedTerritory);
  useEffect(() => {
    selectedTerritoryRef.current = selectedTerritory;
  }, [selectedTerritory]);

  // Fallback Map
  const activeTerritoryMap = useRef<Map<string, ExtTerritory>>(new Map());
  const ownerProfileMapRef = useRef<Map<string, { nickname: string; avatarUrl: string | null }>>(new Map());
  const territoryMetricsRef = useRef<TerritoryMetric[]>([]);

  // 闃叉 map click 鍦?polygon click 涔嬪悗绔嬪嵆娓呴櫎閫夋嫨锛堟満鍒跺凡绉诲嚭鍒?AMapView Root Layer锛?
  const territoryClickedRef = useRef(false);

  const resolveFactionColor = useCallback((ownerFaction: string | null | undefined) => {
    const key = (ownerFaction || '').toLowerCase();
    if (key.includes('blue') || key.includes('azure') || key.includes('蔚蓝') || key.includes('cyan')) {
      return '#3b82f6';
    }
    if (key.includes('red') || key.includes('crimson') || key.includes('赤红')) {
      return '#ef4444';
    }
    return '#64748b';
  }, []);

  const computePathBounds = useCallback((path: [number, number][]) => {
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (const [lng, lat] of path) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    return { minLng, maxLng, minLat, maxLat };
  }, []);

  const estimateTerritoryArea = useCallback((path: [number, number][]) => {
    const ring = path[0][0] === path[path.length - 1][0] && path[0][1] === path[path.length - 1][1] ? path : [...path, path[0]];
    return turf.area(turf.polygon([ring]));
  }, []);

  const recomputeViewportKing = useCallback(() => {
    if (!map || kingdomMode !== 'personal') {
      onViewportKingChange?.(null);
      return;
    }
    const bounds = map.getBounds?.();
    if (!bounds) {
      onViewportKingChange?.(null);
      return;
    }
    const northEast = bounds.getNorthEast?.();
    const southWest = bounds.getSouthWest?.();
    if (!northEast || !southWest) {
      onViewportKingChange?.(null);
      return;
    }
    const viewportMinLng = southWest.getLng();
    const viewportMaxLng = northEast.getLng();
    const viewportMinLat = southWest.getLat();
    const viewportMaxLat = northEast.getLat();
    const totals = new Map<string, number>();
    for (const metric of territoryMetricsRef.current) {
      const intersects = metric.maxLng >= viewportMinLng &&
        metric.minLng <= viewportMaxLng &&
        metric.maxLat >= viewportMinLat &&
        metric.minLat <= viewportMaxLat;
      if (!intersects) continue;
      totals.set(metric.ownerId, (totals.get(metric.ownerId) || 0) + metric.area);
    }
    if (totals.size === 0) {
      onViewportKingChange?.(null);
      return;
    }
    let kingOwnerId = '';
    let kingArea = 0;
    totals.forEach((area, ownerId) => {
      if (area > kingArea) {
        kingArea = area;
        kingOwnerId = ownerId;
      }
    });
    if (!kingOwnerId) {
      onViewportKingChange?.(null);
      return;
    }
    const profile = ownerProfileMapRef.current.get(kingOwnerId);
    onViewportKingChange?.({
      ownerId: kingOwnerId,
      nickname: profile?.nickname || `领主-${kingOwnerId.slice(0, 6)}`,
      avatarUrl: profile?.avatarUrl || null,
      totalArea: kingArea,
    });
  }, [kingdomMode, map, onViewportKingChange]);

  // 鍙楁帶鐨?ContextSwitch 鎷︽埅鍣細纭繚鐪熸鐨勮涔夊彉鏇存墠瑙﹀彂娓呯┖
  const prevContextRef = useRef({ cityId: city?.id, viewMode, kingdomMode });
  useEffect(() => {
    const prev = prevContextRef.current;
    
    // 鍙湪闈炲垵濮嬫寕杞斤紙鍗宠嚦灏戞湁涓€涓凡缂撳瓨锛夛紝涓旂‘瀹炲彂鐢熶簡涓ユ牸鍙樺寲鏃讹紝鎵嶆竻绌洪€変腑
    // 杩欓噷鐣ヨ繃浜嗗灏氭湭璁剧疆 city 鐨勬瀬鍒濇湡杩囨护
    const isChanged = 
      (city?.id !== undefined && city?.id !== prev.cityId) || 
      (viewMode !== undefined && viewMode !== prev.viewMode) || 
      (kingdomMode !== undefined && kingdomMode !== prev.kingdomMode);

    if (isChanged) {
      console.log(`[Audit] ContextSwitch clear: city ${prev.cityId}->${city?.id} viewMode ${prev.viewMode}->${viewMode} kingdomMode ${prev.kingdomMode}->${kingdomMode}`);
      setSelectedTerritory?.(null);
    }
    
    // 姘歌繙鍚屾鏈€鏂?ref
    prevContextRef.current = { cityId: city?.id, viewMode, kingdomMode };
  }, [city, viewMode, kingdomMode, setSelectedTerritory]);

  // Load territories
  useEffect(() => {
    if (!map || !city) return;

    let mounted = true;

    const loadTerritories = async (retryCount = 0) => {
      try {
        console.log(`[Audit] loadTerritories: cityId=${city.id} map=${!!map} retry=${retryCount}`);
        const data = await fetchTerritories(city.id);
        
        if (!mounted) return;
        if (!data || !Array.isArray(data)) {
           throw new Error('API returned invalid data format');
        }

        if (data && data.length > 0) {
          logEvent('territory_render_success', { count: data.length });
        } else {
          logEvent('territory_render_empty', { cityId: city.id });
        }
        const ownerIds = Array.from(new Set(data.map(item => item.ownerId).filter((id): id is string => Boolean(id))));
        const profileMap = new Map<string, { nickname: string; avatarUrl: string | null }>();
        if (ownerIds.length > 0) {
          const supabase = createClient();
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id,nickname,avatar_url')
            .in('id', ownerIds);
          (profiles || []).forEach((profile: OwnerProfile) => {
            profileMap.set(profile.id, {
              nickname: profile.nickname || `领主-${profile.id.slice(0, 6)}`,
              avatarUrl: profile.avatar_url || null,
            });
          });
        }
        ownerProfileMapRef.current = profileMap;

        console.log(`[Audit] Success: API returned ${data.length} items`);

        const newPolygonMap = new Map<any, { territory: ExtTerritory; defaultStrokeColor: string }>();
        const newCellMap = new Map<string, ExtTerritory>();

        const territoryMetrics: TerritoryMetric[] = [];
        const createdPolygons = data.map((territory) => {
          newCellMap.set(territory.id, territory);
          let path: [number, number][] = [];
          
          if (territory.geojson_json && territory.geojson_json.coordinates) {
             if (territory.geojson_json.type === 'Polygon') {
               path = territory.geojson_json.coordinates[0];
             } else {
               return null;
             }
          }
          if (!path || path.length < 3) return null;

          const ctx: ViewContext = {
            userId: user?.id || null,
            subject: kingdomMode === 'club' ? 'club' : (viewMode === 'faction' ? 'faction' : 'individual')
          };
          const style = generateTerritoryStyle(territory, ctx);
          const isFactionColorActive = kingdomMode === 'personal' && showFactionColors;
          const factionBaseColor = resolveFactionColor(territory.ownerFaction);
          const factionVisuals = calculateHealthVisuals(
            factionBaseColor,
            territory.health ?? territory.maxHealth ?? 100,
            territory.maxHealth ?? 100
          );
          const fillColor = isFactionColorActive ? factionVisuals.fillColor2D : style.fillColor2D;
          const baseStrokeColor = isFactionColorActive ? factionBaseColor : style.strokeColor2D;
          const territoryHealth = territory.health ?? territory.maxHealth ?? 100;
          const isLowHealth = territoryHealth < 50;
          const strokeColor = isLowHealth ? '#facc15' : baseStrokeColor;
          const polygonFillOpacity = isLowHealth
            ? 0.2
            : (kingdomMode === 'club' ? 0.15 : 0.5);
          if (territory.ownerId) {
            const area = estimateTerritoryArea(path);
            const bounds = computePathBounds(path);
            territoryMetrics.push({
              ownerId: territory.ownerId,
              area,
              ...bounds,
            });
          }

          const polygon = new (window as any).AMap.Polygon({
            path: path,
            fillColor,
            fillOpacity: polygonFillOpacity,
            strokeColor,
            strokeWeight: isLowHealth ? 3 : 2,
            zIndex: 50,
            extData: territory,
            bubble: false,
          });

          newPolygonMap.set(polygon, {
            territory,
            defaultStrokeColor: strokeColor,
          });

          let marker = null;
          if (kingdomMode === 'club' && territory.ownerClub) {
            let markerPosition: [number, number];
            try {
              const coords = path.map((p: any) => [p[0], p[1]]);
              if (coords.length > 0 && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
                coords.push(coords[0]);
              }
              const poly = turf.polygon([coords]);
              const pt = turf.pointOnFeature(poly);
              markerPosition = pt.geometry.coordinates as [number, number];
            } catch {
              const center = polygon.getBounds().getCenter();
              markerPosition = [center.getLng(), center.getLat()];
            }
            
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
              zooms: [12, 20],
            });
            (marker as any).__avatarContentEl = content;
          }


          polygon.on("click", (e: any) => {
            (window as any).__amap_polygon_clicked = Date.now();
            if (openTerritoryDetailDrawer && territory.id) {
              openTerritoryDetailDrawer(territory.id);
            } else {
              setSelectedTerritory?.(territory);
              setIsDetailSheetOpen?.(true);
            }
          });

          polygon.on("mouseover", () => {
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
        territoryMetricsRef.current = territoryMetrics;
        recomputeViewportKing();

        // Atomic update on map
        if (map) {
          setPolygons(prev => {
            prev.forEach(p => p && p.setMap && p.setMap(null));
            const validPolygons = createdPolygons.filter(item => item !== null).map(item => item!.polygon).filter(p => !!p);
            map.add(validPolygons);
            return validPolygons;
          });

          setMarkers(prev => {
            prev.forEach(m => m && m.setMap && m.setMap(null));
            const validMarkers = createdPolygons.filter(item => item !== null).map(item => item!.marker).filter(m => !!m);
            map.add(validMarkers);
            return validMarkers;
          });
        }
        
        // [鍩嬬偣琛ラ綈] 娓叉煋鎴愬姛
        logEvent('territory_render_success', { cityId: city.id, count: data.length });

      } catch (error: any) {
        if (!mounted) return;
        if (error?.name !== 'AbortError' && error?.digest !== 'NEXT_REDIRECT') {
          console.error(`Failed to load territories (retry=${retryCount}):`, error);
          
          // 鍩嬬偣: territory_render_retry
          logEvent('territory_render_retry', { retryCount: retryCount + 1, error: error.message });

          if (retryCount < 4) {
            const delay = 500 * Math.pow(2, retryCount); 
            setTimeout(() => {
              if (mounted) loadTerritories(retryCount + 1);
            }, delay);
          }
        }
      }
    };

    loadTerritories();

    const handleRefresh = () => {
      loadTerritories();
    };
    window.addEventListener('citylord:refresh-territories', handleRefresh);

    return () => {
      mounted = false;
      window.removeEventListener('citylord:refresh-territories', handleRefresh);
    };
  // 鍔犲叆 user?.id 纭繚璁よ瘉鐘舵€佸彉鍖栧悗 polygon 閲嶅缓锛屼互鑾峰緱姝ｇ‘鐨?self/enemy 鏍峰紡
  }, [
    map,
    city,
    viewMode,
    kingdomMode,
    user?.id,
    openTerritoryDetailDrawer,
    setSelectedTerritory,
    setIsDetailSheetOpen,
    showFactionColors,
    resolveFactionColor,
    estimateTerritoryArea,
    computePathBounds,
    recomputeViewportKing,
  ]);

  useEffect(() => {
    if (!map) return;
    if (kingdomMode !== 'personal') {
      onViewportKingChange?.(null);
      return;
    }
    let debounceTimer: NodeJS.Timeout | null = null;
    const schedule = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        recomputeViewportKing();
      }, 300);
    };
    schedule();
    map.on('moveend', schedule);
    map.on('zoomend', schedule);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      map.off('moveend', schedule);
      map.off('zoomend', schedule);
    };
  }, [map, kingdomMode, recomputeViewportKing, onViewportKingChange]);

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

  // 淇变箰閮?Marker 澶村儚闅?zoom 绾у埆鍔ㄦ€佺缉鏀?
  useEffect(() => {
    if (!map || kingdomMode !== 'club' || markers.length === 0) return;

    const MIN_ZOOM = 12;
    const MAX_ZOOM = 18;
    const MIN_SIZE = 16;   // px
    const MAX_SIZE = 64;   // px

    const updateMarkerSizes = () => {
      const zoom = map.getZoom();
      // 绾挎€ф槧灏?[MIN_ZOOM, MAX_ZOOM] 鈫?[MIN_SIZE, MAX_SIZE]
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

    // 鍒濆鍖栦竴娆?
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
