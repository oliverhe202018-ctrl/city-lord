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
import debounce from 'lodash.debounce';
import { useGameStore, useGameTerritoryAppearance } from "@/store/useGameStore";
type AMapRing = [number, number][];
type AMapPolygonPath = AMapRing[];
type AMapMultiPolygonPath = AMapPolygonPath[];

const toRing = (ring: any[]): AMapRing =>
  ring
    .map((pt: any) => {
      if (Array.isArray(pt)) return [Number(pt[0]), Number(pt[1])] as [number, number];
      if (pt?.lng !== undefined && pt?.lat !== undefined) return [Number(pt.lng), Number(pt.lat)] as [number, number];
      return null;
    })
    .filter((pt): pt is [number, number] => pt !== null && !isNaN(pt[0]) && !isNaN(pt[1]));

const closeRing = (ring: AMapRing): AMapRing => {
  if (ring.length < 3) return ring;
  const [sx, sy] = ring[0];
  const [ex, ey] = ring[ring.length - 1];
  return sx === ex && sy === ey ? ring : [...ring, ring[0]];
};

const normalizePolygonRings = (rings: any[]): AMapPolygonPath => {
  if (!Array.isArray(rings)) return [];
  return rings
    .map((ring) => closeRing(toRing(ring)))
    .filter((ring) => ring.length >= 4);
};

const extractAmapPaths = (input: any): AMapMultiPolygonPath => {
  if (!input) return [];

  if (input.type === 'Feature') {
    return extractAmapPaths(input.geometry);
  }

  if (input.type === 'FeatureCollection') {
    return (input.features || []).flatMap((f: any) => extractAmapPaths(f));
  }

  if (input.type === 'Polygon') {
    const polygon = normalizePolygonRings(input.coordinates);
    return polygon.length > 0 ? [polygon] : [];
  }

  if (input.type === 'MultiPolygon') {
    return (input.coordinates || [])
      .map((polygonRings: any[]) => normalizePolygonRings(polygonRings))
      .filter((polygon: AMapPolygonPath) => polygon.length > 0);
  }

  return [];
};

/** Club mode palette: own club vs enemy club */
const CLUB_COLORS = {
  self: { fill: '#3b82f6', stroke: '#2563eb', fillOpacity: 0.35 },
  enemy: { fill: '#ef4444', stroke: '#dc2626', fillOpacity: 0.25 },
  neutral: { fill: '#64748b', stroke: '#475569', fillOpacity: 0.15 },
} as const;

// Color safety net constants
const DEFAULT_FILL = '#FF6B35';
const DEFAULT_STROKE = '#CC4A1A';
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Validates a color string and returns a fallback if invalid.
 */
const safeColor = (c: any, fallback: string): string =>
  (typeof c === 'string' && HEX_COLOR_RE.test(c)) ? c : fallback;

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

const fetchTerritories = async (cityId: string, bounds?: { minLng: number, minLat: number, maxLng: number, maxLat: number }): Promise<ExtTerritory[]> => {
  let url = `/api/city/fetch-territories?cityId=${cityId}`;
  if (bounds) {
    url += `&minLng=${bounds.minLng}&minLat=${bounds.minLat}&maxLng=${bounds.maxLng}&maxLat=${bounds.maxLat}`;
  }
  const res = await fetchWithTimeout(url, { credentials: 'include', cache: 'no-store' })
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
  viewMode?: string;
  onViewportKingChange?: (king: ViewportKingData | null) => void;
}

interface OwnerProfile {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
}

interface TerritoryMetric {
  ownerId: string;
  feature: any;
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

type DisplayLevel = 'club' | 'individual';

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
const TerritoryLayer: React.FC<TerritoryLayerProps> = ({ map, isVisible, kingdomMode, showFactionColors = false, viewMode: propViewMode, onViewportKingChange }) => {
  const [polygons, setPolygons] = useState<any[]>([]);
  const [markers, setMarkers] = useState<any[]>([]);
  const { currentCity: city } = useCity();
  const { viewMode: contextViewMode, selectedTerritory, setSelectedTerritory, setIsDetailSheetOpen, openTerritoryDetailDrawer } = useMapInteraction();
  const resolvedViewMode = propViewMode ?? contextViewMode;
  const { user } = useAuth();
  const { territoryAppearance } = useGameTerritoryAppearance();
  const clubId = useGameStore((state) => state.clubId);
  const faction = useGameStore((state) => state.faction);
  const setSelectedTerritoryId = useGameStore((state) => state.setSelectedTerritoryId);
  const selectedTerritoryId = useGameStore((state) => state.selectedTerritoryId);

  // Track polygon 鈫?territory mapping for highlight updates
  const polygonTerritoryMap = useRef<Map<any, { territory: ExtTerritory; defaultStrokeColor: string; path: [number, number][] }>>(new Map());
  const unionGeometryCache = useRef<Map<string, { hash: string; paths: AMapMultiPolygonPath; markerPos: [number, number] | null }>>(new Map());

  // 鐢ㄤ簬 hover handler 涓幏鍙栨渶鏂扮殑 selectedTerritory锛岄伩鍏?stale closure
  const selectedTerritoryRef = useRef<ExtTerritory | null | undefined>(selectedTerritory);
  useEffect(() => {
    selectedTerritoryRef.current = selectedTerritory;
  }, [selectedTerritory]);

  // Fallback Map
  const activeTerritoryMap = useRef<Map<string, ExtTerritory>>(new Map());
  const ownerProfileMapRef = useRef<Map<string, { nickname: string; avatarUrl: string | null }>>(new Map());
  const territoryMetricsRef = useRef<TerritoryMetric[]>([]);
  const haloPolygonsRef = useRef<any[]>([]);
  const haloPulseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastViewportKingIdRef = useRef<string | null>(null);
  const lastAuthUserIdRef = useRef<string | null>(user?.id ?? null);

  const resolveFactionColor = useCallback(
    (ownerFaction: string | null | undefined): string => {
      if (!ownerFaction) return '#64748b'; // No faction → neutral slate gray
      // Exact match first (DB stores 'Red' / 'Blue' as confirmed in faction.ts)
      if (ownerFaction === 'Red') return '#ef4444';
      if (ownerFaction === 'Blue') return '#3b82f6';
      if (ownerFaction === 'RED') return '#ef4444';
      if (ownerFaction === 'BLUE') return '#3b82f6';
      // Fallback keyword match for legacy / localized values
      const key = ownerFaction.toLowerCase().trim();
      if (key.includes('blue') || key.includes('azure') || key.includes('cyan') || key.includes('water')) return '#3b82f6';
      if (key.includes('red') || key.includes('crimson') || key.includes('scarlet') || key.includes('fire')) return '#ef4444';
      if (key.includes('green') || key.includes('emerald')) return '#22c55e';
      if (key.includes('purple') || key.includes('violet')) return '#a855f7';
      // Default: neutral for unknown factions
      return '#64748b';
    },
    []);

  const getDisplayLevelByZoom = useCallback((zoom: number): DisplayLevel => {
    if (kingdomMode === 'club' && zoom < 14) {
      return 'club';
    }
    return 'individual';
  }, [kingdomMode]);

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

  const clearViewportKingHalo = useCallback(() => {
    if (haloPulseTimerRef.current) {
      clearInterval(haloPulseTimerRef.current);
      haloPulseTimerRef.current = null;
    }
    haloPolygonsRef.current.forEach((halo) => halo?.setMap?.(null));
    haloPolygonsRef.current = [];
  }, []);

  const clearRenderedLayers = useCallback(() => {
    setPolygons((prev) => {
      prev.forEach((polygon) => polygon?.setMap?.(null));
      return [];
    });
    setMarkers((prev) => {
      prev.forEach((marker) => marker?.setMap?.(null));
      return [];
    });
    polygonTerritoryMap.current.clear();
    activeTerritoryMap.current.clear();
    ownerProfileMapRef.current.clear();
    territoryMetricsRef.current = [];
    clearViewportKingHalo();
    onViewportKingChange?.(null);
    setSelectedTerritory?.(null);
  }, [clearViewportKingHalo, onViewportKingChange, setSelectedTerritory]);

  const applyViewportKingHalo = useCallback((kingOwnerId: string | null) => {
    clearViewportKingHalo();
    lastViewportKingIdRef.current = kingOwnerId;

    if (!map || !kingOwnerId) {
      return;
    }

    const haloPolygons: any[] = [];

    polygonTerritoryMap.current.forEach(({ territory, path }) => {
      if (territory.ownerId !== kingOwnerId) {
        return;
      }

      const halo = new (window as any).AMap.Polygon({
        path,
        fillOpacity: 0,
        strokeColor: safeColor('#fbbf24', '#fbbf24'),
        strokeOpacity: 0.42,
        strokeWeight: 5,
        zIndex: 45,
        bubble: false,
        cursor: 'default',
      });

      haloPolygons.push(halo);
    });

    if (haloPolygons.length === 0) {
      return;
    }

    map.add(haloPolygons);
    haloPolygonsRef.current = haloPolygons;

    let tick = 0;
    haloPulseTimerRef.current = setInterval(() => {
      tick += 1;
      const pulse = (Math.sin(tick / 2) + 1) / 2;
      const strokeOpacity = 0.28 + pulse * 0.45;
      const strokeWeight = 4 + pulse * 4;
      haloPolygonsRef.current.forEach((halo) => {
        halo?.setOptions?.({
          strokeOpacity,
          strokeWeight,
        });
      });
    }, 180);
  }, [clearViewportKingHalo, kingdomMode, map]);

  const buildPolygonPresentation = useCallback((territory: ExtTerritory) => {
    const territoryHealth = territory.health ?? territory.maxHealth ?? 100;
    const isLowHealth = territoryHealth < 50;

    // --- Club mode: all territories visible, own club highlighted, enemies in red ---
    if (kingdomMode === 'club') {
      const isSelfClub = Boolean(clubId && territory.ownerClubId && territory.ownerClubId === clubId);
      const hasClub = Boolean(territory.ownerClubId);
      const palette = isSelfClub ? CLUB_COLORS.self : (hasClub ? CLUB_COLORS.enemy : CLUB_COLORS.neutral);
      return {
        fillColor: isLowHealth ? '#facc15' : palette.fill,
        fillOpacity: isLowHealth ? 0.15 : palette.fillOpacity,
        strokeColor: isLowHealth ? '#facc15' : palette.stroke,
        strokeWeight: isSelfClub ? 3 : 2,
      };
    }

    // --- Personal mode ---
    const ctx: ViewContext = {
      userId: user?.id || null,
      clubId: clubId || null,
      faction: faction || null,
      subject: resolvedViewMode === 'faction' ? 'faction' : 'individual'
    };
    const style = generateTerritoryStyle(territory, ctx);
    const isFactionColorActive = showFactionColors || resolvedViewMode === 'faction';
    // ✅ 优先使用 DB 直接存储的 hex 色值，避免依赖字符串关键字匹配（UUID faction_id 等场景下匹配全部失败）
    const factionBaseColor = territory.ownerFactionColor
      ? safeColor(territory.ownerFactionColor, resolveFactionColor(territory.ownerFaction))
      : resolveFactionColor(territory.ownerFaction);
    const factionVisuals = calculateHealthVisuals(
      factionBaseColor,
      territory.health ?? territory.maxHealth ?? 100,
      territory.maxHealth ?? 100
    );
    const isSelfTerritory = Boolean(user?.id && territory.ownerId === user.id);
    const allowCustomAppearance = !isFactionColorActive && isSelfTerritory;

    // Use player's specific color if available (profile colors fetched from API)
    const specificFillColor = (territory as any).ownerFillColor;
    const specificStrokeColor = (territory as any).ownerPathColor;

    const fillColor = allowCustomAppearance
      ? territoryAppearance.fillColor || DEFAULT_FILL
      : (isFactionColorActive
        ? safeColor(factionBaseColor, DEFAULT_FILL)
        : specificFillColor || (style as any).fillColor || style.fillColor2D || DEFAULT_FILL);

    const baseStrokeColor = allowCustomAppearance
      ? territoryAppearance.strokeColor || DEFAULT_STROKE
      : (isFactionColorActive
        ? (factionVisuals as any).strokeColor || factionBaseColor || DEFAULT_STROKE
        : specificStrokeColor || (style as any).strokeColor || style.strokeColor2D || DEFAULT_STROKE);

    const strokeColor = isLowHealth ? '#facc15' : baseStrokeColor;
    const fillOpacity = allowCustomAppearance
      ? territoryAppearance.fillOpacity
      : (isLowHealth ? 0.2 : 0.5);

    return {
      fillColor,
      fillOpacity,
      strokeColor,
      strokeWeight: isLowHealth ? 3 : 2,
    };
  }, [clubId, kingdomMode, resolveFactionColor, showFactionColors, territoryAppearance.fillColor, territoryAppearance.fillOpacity, territoryAppearance.strokeColor, user?.id, resolvedViewMode]);

  const recomputeViewportKing = useCallback(() => {
    if (!map) {
      applyViewportKingHalo(null);
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
    const viewportBbox: [number, number, number, number] = [viewportMinLng, viewportMinLat, viewportMaxLng, viewportMaxLat];
    for (const metric of territoryMetricsRef.current) {
      const intersects = metric.maxLng >= viewportMinLng &&
        metric.minLng <= viewportMaxLng &&
        metric.maxLat >= viewportMinLat &&
        metric.minLat <= viewportMaxLat;
      if (!intersects) continue;
      try {
        const clipped = turf.bboxClip(metric.feature, viewportBbox);
        const clippedArea = turf.area(clipped);
        if (clippedArea <= 0) continue;
        totals.set(metric.ownerId, (totals.get(metric.ownerId) || 0) + clippedArea);
      } catch {
        continue;
      }
    }
    if (totals.size === 0) {
      applyViewportKingHalo(null);
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
      applyViewportKingHalo(null);
      onViewportKingChange?.(null);
      return;
    }
    const profile = ownerProfileMapRef.current.get(kingOwnerId);
    applyViewportKingHalo(kingOwnerId);
    onViewportKingChange?.({
      ownerId: kingOwnerId,
      nickname: (profile?.nickname && profile.nickname.trim() !== '')
        ? profile.nickname.trim()
        : `领主-${kingOwnerId.slice(0, 6)}`,
      avatarUrl: profile?.avatarUrl || null,
      totalArea: kingArea,
    });
  }, [applyViewportKingHalo, kingdomMode, map, onViewportKingChange]);

  // 鍙楁帶鐨?ContextSwitch 鎷︽埅鍣細纭繚鐪熸鐨勮涔夊彉鏇存墠瑙﹀彂娓呯┖
  const prevContextRef = useRef({ cityId: city?.id, resolvedViewMode, kingdomMode });
  useEffect(() => {
    const prev = prevContextRef.current;

    // 鍙湪闈炲垵濮嬫寕杞斤紙鍗宠嚦灏戞湁涓€涓凡缂撳瓨锛夛紝涓旂‘瀹炲彂鐢熶簡涓ユ牸鍙樺寲鏃讹紝鎵嶆竻绌洪€変腑
    // 杩欓噷鐣ヨ繃浜嗗灏氭湭璁剧疆 city 鐨勬瀬鍒濇湡杩囨护
    const isChanged =
      (city?.id !== undefined && city?.id !== prev.cityId) ||
      (resolvedViewMode !== undefined && resolvedViewMode !== prev.resolvedViewMode) ||
      (kingdomMode !== undefined && kingdomMode !== prev.kingdomMode);

    if (isChanged) {
      console.log(`[Audit] ContextSwitch clear: city ${prev.cityId}->${city?.id} resolvedViewMode ${prev.resolvedViewMode}->${resolvedViewMode} kingdomMode ${prev.kingdomMode}->${kingdomMode}`);
      setSelectedTerritory?.(null);
    }

    // 姘歌繙鍚屾鏈€鏂?ref
    prevContextRef.current = { cityId: city?.id, resolvedViewMode, kingdomMode };
  }, [city, resolvedViewMode, kingdomMode, setSelectedTerritory]);

  // Load territories
  useEffect(() => {
    if (!map || !city) return;

    let mounted = true;

    const loadTerritories = async (bounds?: { minLng: number, minLat: number, maxLng: number, maxLat: number }, isIncremental = false, retryCount = 0) => {
      try {
        console.log(`[Audit] loadTerritories: cityId=${city.id} map=${!!map} retry=${retryCount}`);
        const rawData = await fetchTerritories(city.id, bounds);

        if (!mounted) return;
        if (!rawData || !Array.isArray(rawData)) {
          throw new Error('API returned invalid data format');
        }

        let data = rawData;
        if (isIncremental) {
          const existingIds = new Set(Array.from(activeTerritoryMap.current.keys()));
          data = rawData.filter(t => !existingIds.has(t.id));
          if (data.length === 0) return;
        } else {
          polygonTerritoryMap.current.clear();
          activeTerritoryMap.current.clear();
          unionGeometryCache.current.clear();
          setPolygons(prev => { prev.forEach(p => p && p.setMap && p.setMap(null)); return []; });
          setMarkers(prev => { prev.forEach(m => m && m.setMap && m.setMap(null)); return []; });
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
              nickname: (profile.nickname && profile.nickname.trim() !== '')
                ? profile.nickname.trim()
                : `领主-${profile.id.slice(0, 6)}`,
              avatarUrl: profile.avatar_url || null,
            });
          });
        }
        ownerProfileMapRef.current = profileMap;

        console.log(`[Audit] Success: API returned ${data.length} items`);

        const newPolygonMap = isIncremental ? polygonTerritoryMap.current : new Map<any, { territory: ExtTerritory; defaultStrokeColor: string; path: [number, number][] }>();
        const newCellMap = isIncremental ? activeTerritoryMap.current : new Map<string, ExtTerritory>();

        const territoryMetrics: TerritoryMetric[] = isIncremental ? territoryMetricsRef.current : [];

        // --- POLYGON UNION ALGORITHM & GEOMETRY CACHING FOR CLUB MODE ---

        const renderItems: { territory: ExtTerritory; paths: AMapMultiPolygonPath; isClubMerged: boolean; markerPos?: [number, number] | null }[] = [];
        data.forEach(t => newCellMap.set(t.id, t));

        if (kingdomMode === 'club') {
          const clubGroups = new Map<string, ExtTerritory[]>();
          for (const t of data) {
            if (t.ownerClubId) {
              if (!clubGroups.has(t.ownerClubId)) clubGroups.set(t.ownerClubId, []);
              clubGroups.get(t.ownerClubId)!.push(t);
            } else {
              renderItems.push({ territory: t, paths: extractAmapPaths(t.geojson_json), isClubMerged: false });
            }
          }

          clubGroups.forEach((group, clubId) => {
            const hash = group.map(t => t.id).sort().join(',');
            let cached = unionGeometryCache.current.get(clubId);
            if (!cached || cached.hash !== hash) {
              let mergedFeat: any = null;
              for (const t of group) {
                const paths = extractAmapPaths(t.geojson_json);
                paths.forEach(polygon => { // polygon is AMapPolygonPath (array of rings)
                  try {
                    // Turf union expects Features. Convert rings to turf polygons.
                    const poly = turf.cleanCoords(turf.polygon(polygon));
                    if (!mergedFeat) {
                      mergedFeat = poly;
                    } else {
                      try { mergedFeat = turf.union(turf.featureCollection([mergedFeat, poly])); }
                      catch (e) {
                        try { mergedFeat = (turf as any).union(mergedFeat, poly); } catch (e) {
                          renderItems.push({ territory: t, paths: [polygon], isClubMerged: false });
                        }
                      }
                    }
                  } catch (e) {
                    renderItems.push({ territory: t, paths: [polygon], isClubMerged: false });
                  }
                });
              }
              
              const mergedPaths: AMapMultiPolygonPath =
                mergedFeat?.geometry ? extractAmapPaths(mergedFeat) : [];

              let markerPos: [number, number] | null = null;
              try {
                if (mergedFeat) {
                  const pt = turf.pointOnFeature(mergedFeat);
                  markerPos = pt.geometry.coordinates as [number, number];
                }
              } catch (e) { }

              cached = { hash, paths: mergedPaths, markerPos };
              unionGeometryCache.current.set(clubId, cached);
            }
            const cacheEntry = unionGeometryCache.current.get(clubId);
            if (cacheEntry && cacheEntry.paths.length > 0) {
              renderItems.push({ territory: group[0], paths: cacheEntry.paths, isClubMerged: true, markerPos: cacheEntry.markerPos });
            }
          });
        } else {
          data.forEach(t => renderItems.push({ territory: t, paths: extractAmapPaths(t.geojson_json), isClubMerged: false }));
        }

        const createdPolygons = renderItems.map(({ territory, paths, isClubMerged, markerPos: precalcMarkerPos }) => {
          const validPaths = paths;
          if (validPaths.length === 0) return null;

          const primaryPolygon = validPaths[0];
          const primaryOuterRing = primaryPolygon?.[0];
          if (!primaryOuterRing || primaryOuterRing.length < 4) return null;

          const presentation = buildPolygonPresentation(territory);

          if (territory.ownerId) {
            validPaths.forEach((polygonRings) => {
              const outerRing = polygonRings[0];
              if (!outerRing || outerRing.length < 4) return;

              const bounds = computePathBounds(outerRing);
              territoryMetrics.push({
                ownerId: territory.ownerId as string,
                feature: turf.polygon(polygonRings),
                ...bounds,
              });
            });
          }

          const polygon = new (window as any).AMap.Polygon({
            path: validPaths,
            fillColor: safeColor(presentation.fillColor, DEFAULT_FILL),
            fillOpacity: presentation.fillOpacity,
            strokeColor: safeColor(presentation.strokeColor, DEFAULT_STROKE),
            strokeWeight: presentation.strokeWeight,
            zIndex: 50,
            extData: territory,
            bubble: false,
          });

          newPolygonMap.set(polygon, {
            territory,
            defaultStrokeColor: presentation.strokeColor,
            path: primaryOuterRing,
          });

          polygon.on("click", (e: any) => {
            (window as any).__amap_polygon_clicked = Date.now();
            setSelectedTerritoryId(territory.id);
            if (setSelectedTerritory) setSelectedTerritory(territory);
            if (setIsDetailSheetOpen) setIsDetailSheetOpen(true);
            
            if (e) {
                e.cancelBubble = true;
                if (e.originEvent?.stopPropagation) {
                    e.originEvent.stopPropagation();
                }
            }
          });

          if (!isClubMerged) {
            polygon.on("mouseover", () => {
              if (selectedTerritoryRef.current?.id !== territory.id) polygon.setOptions({ strokeWeight: 3 });
            });
            polygon.on("mouseout", () => {
              if (selectedTerritoryRef.current?.id !== territory.id) polygon.setOptions({ strokeWeight: 2 });
            });
          }

          let marker = null;
          if (territory.ownerId) {
            let markerPosition: [number, number];
            if (precalcMarkerPos) {
              markerPosition = precalcMarkerPos;
            } else {
              try {
                const feature = validPaths.length === 1
                  ? turf.polygon(validPaths[0])
                  : turf.multiPolygon(validPaths);
                const pt = turf.pointOnFeature(feature);
                markerPosition = pt.geometry.coordinates as [number, number];
              } catch {
                const center = polygon.getBounds().getCenter();
                markerPosition = [center.getLng(), center.getLat()];
              }
            }

            const ownerProfile = profileMap.get(territory.ownerId);
            const displayLevel = getDisplayLevelByZoom(map.getZoom());
            const baseSize = isClubMerged ? 40 : (displayLevel === 'club' ? 24 : 32);

            let avatarHtml = '';
            // In club merged mode or club kingdom mode, exclusively show the club container
            if (isClubMerged || kingdomMode === 'club') {
              if (territory.ownerClub?.logoUrl) {
                avatarHtml = `<img src="${territory.ownerClub.logoUrl}" class="w-full h-full object-cover" />`;
              } else {
                const char = (territory.ownerClub?.name || ownerProfile?.nickname || '').substring(0, 1) || '领';
                avatarHtml = `<span class="text-[10px] text-white font-bold leading-none">${char}</span>`;
              }
            } else {
              if (ownerProfile?.avatarUrl) {
                avatarHtml = `<img src="${ownerProfile.avatarUrl}" class="w-full h-full object-cover" />`;
              } else {
                const char = (ownerProfile?.nickname || '').substring(0, 1) || '领';
                avatarHtml = `<span class="text-[10px] text-white font-bold leading-none">${char}</span>`;
              }
            }

            const contentHtml = `
              <div class="pointer-events-none territory-marker" style="width: ${baseSize}px; height: ${baseSize}px; margin-left: -${baseSize / 2}px; margin-top: -${baseSize / 2}px;">
                <div class="w-full h-full rounded-full overflow-hidden border border-white bg-black/60 shadow flex items-center justify-center">
                  ${avatarHtml}
                </div>
              </div>
            `;

            // Hide zoom restrictions if it's the large club merged avatar (show at all zoom levels)
            marker = new (window as any).AMap.Marker({
              position: markerPosition,
              content: contentHtml,
              zIndex: 60,
              bubble: true,
              zooms: isClubMerged ? [3, 20] : [10, 20],
              extData: { id: territory.id }
            });
          }

          return { polygons: [polygon], marker };
        });

        polygonTerritoryMap.current = newPolygonMap;
        activeTerritoryMap.current = newCellMap;
        territoryMetricsRef.current = territoryMetrics;
        recomputeViewportKing();

        // Atomic update on map
        if (map) {
          setPolygons(prev => {
            const validPolygons = createdPolygons
              .filter(item => item !== null)
              .flatMap(item => item!.polygons)
              .filter(p => !!p);
            map.add(validPolygons);
            return isIncremental ? [...prev, ...validPolygons] : validPolygons;
          });

          setMarkers(prev => {
            const validMarkers = createdPolygons.filter(item => item !== null).map(item => item!.marker).filter(m => !!m);
            map.add(validMarkers);
            return isIncremental ? [...prev, ...validMarkers] : validMarkers;
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
              if (mounted) loadTerritories(bounds, isIncremental, retryCount + 1);
            }, delay);
          }
        }
      }
    };

    loadTerritories(undefined, false);

    const handleRefresh = () => {
      loadTerritories(undefined, false);
    };
    window.addEventListener('citylord:refresh-territories', handleRefresh);

    const fetchTerritoriesInView = debounce((currentMap: any) => {
      if (!currentMap || !mounted) return;
      
      const bounds = currentMap.getBounds();
      if (!bounds) return;

      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();

      loadTerritories({
        minLng: sw.getLng(),
        minLat: sw.getLat(),
        maxLng: ne.getLng(),
        maxLat: ne.getLat()
      }, true);
    }, 500);

    const handleMoveEnd = () => fetchTerritoriesInView(map);
    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleMoveEnd);

    return () => {
      mounted = false;
      window.removeEventListener('citylord:refresh-territories', handleRefresh);
      map.off('moveend', handleMoveEnd);
      map.off('zoomend', handleMoveEnd);
      fetchTerritoriesInView.cancel();
    };
    // 鍔犲叆 user?.id 纭繚璁よ瘉鐘舵€佸彉鍖栧悗 polygon 閲嶅缓锛屼互鑾峰緱姝ｇ‘鐨?self/enemy 鏍峰紡
  }, [
    map,
    city,
    resolvedViewMode,
    showFactionColors,
    kingdomMode,
    user?.id,
    openTerritoryDetailDrawer,
    setSelectedTerritory,
    setIsDetailSheetOpen,
    resolveFactionColor,
    computePathBounds,
    buildPolygonPresentation,
    recomputeViewportKing,
  ]);

  useEffect(() => {
    const currentUserId = user?.id ?? null;
    if (lastAuthUserIdRef.current === currentUserId) {
      return;
    }
    lastAuthUserIdRef.current = currentUserId;
    clearRenderedLayers();
    window.dispatchEvent(new Event('citylord:refresh-territories'));
  }, [clearRenderedLayers, user?.id]);

  // ─── Map blank-click: clear selected territory ───
  useEffect(() => {
    if (!map) return;
    const handleMapClick = () => {
      // Guard: if a polygon was clicked within the last 200ms, skip
      const lastPolygonClick = (window as any).__amap_polygon_clicked || 0;
      if (Date.now() - lastPolygonClick < 200) return;
      // Clear selection
      setSelectedTerritory?.(null);
      setSelectedTerritoryId(null as any);
      setIsDetailSheetOpen?.(false);
    };
    map.on('click', handleMapClick);
    return () => { map.off('click', handleMapClick); };
  }, [map, setSelectedTerritory, setSelectedTerritoryId, setIsDetailSheetOpen]);

  useEffect(() => {
    if (!map) return;
    let debounceTimer: NodeJS.Timeout | null = null;
    const schedule = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        recomputeViewportKing();
      }, 500);
    };
    schedule();
    map.on('moveend', schedule);
    map.on('zoomend', schedule);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      map.off('moveend', schedule);
      map.off('zoomend', schedule);
      clearViewportKingHalo();
    };
  }, [clearViewportKingHalo, map, kingdomMode, recomputeViewportKing, onViewportKingChange]);

  useEffect(() => {
    polygonTerritoryMap.current.forEach(({ territory, path }, polygon) => {
      const presentation = buildPolygonPresentation(territory);
      polygon.setOptions({
        path,
        fillColor: presentation.fillColor,
        fillOpacity: presentation.fillOpacity,
        strokeColor: presentation.strokeColor,
        strokeWeight: presentation.strokeWeight,
      });
      const meta = polygonTerritoryMap.current.get(polygon);
      if (meta) {
        polygonTerritoryMap.current.set(polygon, {
          ...meta,
          defaultStrokeColor: presentation.strokeColor,
        });
      }
    });

    recomputeViewportKing();
  }, [buildPolygonPresentation, clearViewportKingHalo, kingdomMode, recomputeViewportKing, resolvedViewMode, showFactionColors]);

  // Apply selection highlight when selectedTerritoryId changes
  useEffect(() => {
    const activeId = selectedTerritoryId || selectedTerritory?.id || null;
    polygonTerritoryMap.current.forEach(({ territory, defaultStrokeColor }, polygon) => {
      if (activeId && territory.id === activeId) {
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
  }, [selectedTerritoryId, selectedTerritory]);

  // 淇变箰閮?Marker 澶村儚闅?zoom 绾у埆鍔ㄦ€佺缉鏀?
  useEffect(() => {
    if (!map || markers.length === 0) return;

    const MIN_ZOOM = 12;
    const MAX_ZOOM = 18;
    const MIN_SIZE = 16;   // px
    const MAX_SIZE = 64;   // px

    const updateMarkerSizes = () => {
      const zoom = map.getZoom();
      const nextDisplayLevel = getDisplayLevelByZoom(zoom);
      // 绾挎€ф槧灏?[MIN_ZOOM, MAX_ZOOM] 鈫?[MIN_SIZE, MAX_SIZE]
      const t = Math.max(0, Math.min(1, (zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)));
      const size = Math.round(MIN_SIZE + t * (MAX_SIZE - MIN_SIZE));

      markers.forEach((m: any) => {
        const el = m.__avatarContentEl;
        const clubEl = m.__clubContentEl;
        const individualEl = m.__individualContentEl;
        if (el) {
          el.style.width = `${size}px`;
          el.style.height = `${size}px`;
          el.style.marginLeft = `-${size / 2}px`;
          el.style.marginTop = `-${size / 2}px`;
        }
        if (clubEl && individualEl && m.__displayLevel !== nextDisplayLevel) {
          if (nextDisplayLevel === 'club') {
            clubEl.style.display = '';
            individualEl.style.display = 'none';
          } else {
            clubEl.style.display = 'none';
            individualEl.style.display = '';
          }
          m.__displayLevel = nextDisplayLevel;
        }
      });
    };

    // 鍒濆鍖栦竴娆?
    updateMarkerSizes();
    map.on('zoomchange', updateMarkerSizes);
    return () => { map.off('zoomchange', updateMarkerSizes); };
  }, [map, markers, getDisplayLevelByZoom]);

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
