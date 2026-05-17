"use client";

import { useEffect, useRef, useCallback } from "react";
import { logEvent } from "@/lib/native-log";
import type { ExtTerritory } from "@/types/city";
import { useCity } from "@/contexts/CityContext";
import { useMapInteraction } from "./MapInteractionContext";
import { calculateHealthVisuals, generateTerritoryStyle } from "@/lib/citylord/territory-renderer";
import { ViewContext } from "@/types/city";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import type { ViewportKingData } from "./AMapView";
import * as turf from "@turf/turf";
import { useGameStore, useGameTerritoryAppearance } from "@/store/useGameStore";
import { getTerritoryDisplayName } from "@/lib/territory-display";

const CLUB_COLORS = {
  self: { fill: "#3b82f6", stroke: "#2563eb", fillOpacity: 0.35 },
  enemy: { fill: "#ef4444", stroke: "#dc2626", fillOpacity: 0.25 },
  neutral: { fill: "#64748b", stroke: "#475569", fillOpacity: 0.15 },
} as const;

const DEFAULT_FILL = "#FF6B35";
const DEFAULT_STROKE = "#CC4A1A";
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

type PolygonRing = [number, number][];

type TerritoryWithRender = ExtTerritory & {
  fillColor: string;
  strokeColor: string;
  fillOpacity: number;
  strokeWeight: number;
  areaM2: number;
  bbox: { minLng: number; maxLng: number; minLat: number; maxLat: number };
  clubAvatarUrl: string | null;
  isClubMode: boolean;
};

interface TerritoryLayerProps {
  map: any | null;
  isVisible: boolean;
  kingdomMode?: "personal" | "club";
  showFactionColors?: boolean;
  viewMode?: string;
  onViewportKingChange?: (king: ViewportKingData | null) => void;
  currentZoom?: number;
}

interface OwnerProfile {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
}

const safeColor = (c: unknown, fallback: string): string =>
  typeof c === "string" && HEX_COLOR_RE.test(c) ? c : fallback;

const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit, timeoutMs = 15000) => {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
  try {
    let url = input;
    if (typeof url === "string" && url.startsWith("/api")) {
      url = `${process.env.NEXT_PUBLIC_API_SERVER || ""}${url}`;
    }
    const externalSignal = init?.signal;
    const combinedSignal = externalSignal 
      ? AbortSignal.any([externalSignal, timeoutController.signal])
      : timeoutController.signal;
    const { signal: _drop, ...restInit } = init ?? {};
    return await fetch(url, { ...restInit, signal: combinedSignal });
  } finally {
    clearTimeout(timer);
  }
};

const fetchTerritories = async (
  cityId: string,
  signal?: AbortSignal
): Promise<ExtTerritory[]> => {
  const url = `/api/city/fetch-territories?cityId=${cityId}`;
  const res = await fetchWithTimeout(url, { 
    credentials: "include", 
    cache: "no-store",
    signal
  });
  if (!res.ok) throw new Error("Failed to fetch territories");
  return await res.json();
};

const toLngLatTuple = (pt: unknown): [number, number] | null => {
  if (Array.isArray(pt) && pt.length >= 2) {
    const lng = Number(pt[0]);
    const lat = Number(pt[1]);
    if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
  }
  return null;
};

const closeRing = (ring: PolygonRing): PolygonRing => {
  if (ring.length < 3) return ring;
  const [sx, sy] = ring[0];
  const [ex, ey] = ring[ring.length - 1];
  return sx === ex && sy === ey ? ring : [...ring, ring[0]];
};

const normalizeRing = (input: unknown[]): PolygonRing =>
  closeRing(
    input
      .map((pt) => toLngLatTuple(pt))
      .filter((pt): pt is [number, number] => pt !== null)
  );

const extractOuterRings = (geo: unknown): PolygonRing[] => {
  if (!geo || typeof geo !== "object") return [];
  const g = geo as { type?: string; geometry?: unknown; features?: unknown[]; coordinates?: unknown[] };

  if (g.type === "Feature") {
    return extractOuterRings(g.geometry);
  }

  if (g.type === "FeatureCollection") {
    const features = Array.isArray(g.features) ? g.features : [];
    return features.flatMap((feature) => extractOuterRings(feature));
  }

  if (g.type === "Polygon") {
    const rings = Array.isArray(g.coordinates) ? g.coordinates : [];
    const outer = rings[0];
    if (!Array.isArray(outer)) return [];
    const normalized = normalizeRing(outer);
    return normalized.length >= 4 ? [normalized] : [];
  }

  if (g.type === "MultiPolygon") {
    const polygons = Array.isArray(g.coordinates) ? g.coordinates : [];
    return polygons
      .map((poly) => {
        if (!Array.isArray(poly) || !Array.isArray(poly[0])) return null;
        const normalized = normalizeRing(poly[0] as unknown[]);
        return normalized.length >= 4 ? normalized : null;
      })
      .filter((ring): ring is PolygonRing => ring !== null);
  }

  return [];
};

const computeRingBBox = (ring: PolygonRing) => {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return { minLng, maxLng, minLat, maxLat };
};

const PIXEL_AREA_THRESHOLD = 3600;
const imageCache = new Map<string, HTMLImageElement | "loading" | "error">();
const avatarTileCache = new Map<string, HTMLCanvasElement>();

const getOrLoadImage = (
  url: string,
  onLoad: (img: HTMLImageElement) => void
): HTMLImageElement | null => {
  const cached = imageCache.get(url);
  if (cached instanceof HTMLImageElement) return cached;
  if (cached === "loading" || cached === "error") return null;

  imageCache.set(url, "loading");
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    imageCache.set(url, img);
    onLoad(img);
  };
  img.onerror = () => {
    imageCache.set(url, "error");
  };
  img.src = url;
  return null;
};

const getRoundedAvatarTile = (url: string, img: HTMLImageElement, tileSize: number): HTMLCanvasElement => {
  const cacheKey = `${url}::${tileSize}`;
  const cached = avatarTileCache.get(cacheKey);
  if (cached) return cached;

  const offscreen = document.createElement("canvas");
  offscreen.width = tileSize;
  offscreen.height = tileSize;
  const octx = offscreen.getContext("2d");
  if (!octx) return offscreen;

  const radius = tileSize * 0.2;
  octx.beginPath();
  octx.moveTo(radius, 0);
  octx.lineTo(tileSize - radius, 0);
  octx.quadraticCurveTo(tileSize, 0, tileSize, radius);
  octx.lineTo(tileSize, tileSize - radius);
  octx.quadraticCurveTo(tileSize, tileSize, tileSize - radius, tileSize);
  octx.lineTo(radius, tileSize);
  octx.quadraticCurveTo(0, tileSize, 0, tileSize - radius);
  octx.lineTo(0, radius);
  octx.quadraticCurveTo(0, 0, radius, 0);
  octx.closePath();
  octx.clip();
  octx.drawImage(img, 0, 0, tileSize, tileSize);

  avatarTileCache.set(cacheKey, offscreen);
  return offscreen;
};

function renderTerritoryLabels(
  ctx: CanvasRenderingContext2D,
  map: any,
  territories: TerritoryWithRender[],
  viewportMinLng: number,
  viewportMaxLng: number,
  viewportMinLat: number,
  viewportMaxLat: number,
  currentZoom: number,
  ownerProfileMap: Map<string, { nickname: string; avatarUrl: string | null }>
) {
  if (currentZoom < 15) return;

  const AMapGlobal = (window as typeof window & { AMap?: { LngLat: new (lng: number, lat: number) => unknown } }).AMap;
  if (!AMapGlobal?.LngLat) return;

  const labelOpacity = Math.min(1, (currentZoom - 15) / 2);

  for (const territory of territories) {
    if (!territory.bbox) continue;
    const b = territory.bbox;
    const intersects =
      b.maxLng >= viewportMinLng &&
      b.minLng <= viewportMaxLng &&
      b.maxLat >= viewportMinLat &&
      b.minLat <= viewportMaxLat;
    if (!intersects) continue;

    const outerRings = extractOuterRings(territory.geojson_json);
    if (outerRings.length === 0) continue;

    const ring = outerRings[0];
    if (ring.length < 4) continue;

    const centerLng = (b.minLng + b.maxLng) / 2;
    const centerLat = (b.minLat + b.maxLat) / 2;

    const pixel = map.lngLatToContainer?.(new AMapGlobal.LngLat(centerLng, centerLat));
    if (!pixel) continue;
    const x = Number(pixel.x);
    const y = Number(pixel.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    const ownerProfile = territory.ownerId ? ownerProfileMap.get(territory.ownerId) : null;
    const displayName = getTerritoryDisplayName({
      id: territory.id,
      customName: territory.customName,
      clubName: territory.ownerClub?.name,
      ownerNickname: ownerProfile?.nickname
    });

    ctx.save();
    ctx.globalAlpha = labelOpacity;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textWidth = ctx.measureText(displayName).width;
    const padding = 4;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(x - textWidth / 2 - padding, y - 8 - padding, textWidth + padding * 2, 16 + padding * 2, 4);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillText(displayName, x, y);
    ctx.restore();
  }
}

function renderTerritoriesOnCanvas(
  canvas: HTMLCanvasElement,
  map: any,
  territories: TerritoryWithRender[],
  canvasSizeRef: { current: { width: number; height: number } },
  onNeedRedraw?: () => void,
  ownerProfileMap?: Map<string, { nickname: string; avatarUrl: string | null }>
) {
  const size = map.getSize?.();
  if (!size) return;

  const nextWidth = Number(size.width) || 0;
  const nextHeight = Number(size.height) || 0;
  const shouldResize =
    canvasSizeRef.current.width !== nextWidth ||
    canvasSizeRef.current.height !== nextHeight;
  if (shouldResize) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    canvasSizeRef.current = { width: nextWidth, height: nextHeight };
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const bounds = map.getBounds?.();
  if (!bounds) return;

  const northEast = bounds.getNorthEast?.();
  const southWest = bounds.getSouthWest?.();
  if (!northEast || !southWest) return;

  const viewportMinLng = southWest.getLng();
  const viewportMaxLng = northEast.getLng();
  const viewportMinLat = southWest.getLat();
  const viewportMaxLat = northEast.getLat();

  const currentZoom = map.getZoom?.() || 0;
  
  // 根据缩放级别动态调整抽稀步长
  let stride = 1;
  if (currentZoom < 10) stride = 8;      // 低缩放级别，大幅抽稀
  else if (currentZoom < 13) stride = 4; // 中等缩放级别
  else if (currentZoom < 16) stride = 2; // 高缩放级别
  else stride = 1;                       // 最高缩放级别，不抽稀

  const AMapGlobal = (window as typeof window & { AMap?: { LngLat: new (lng: number, lat: number) => unknown } }).AMap;
  if (!AMapGlobal?.LngLat) return;

  for (const territory of territories) {
    // 快速跳出逻辑：如果多边形的 bbox 完全不在当前视口内，则直接跳过
    if (!territory.bbox) continue;
    const b = territory.bbox;
    const intersects =
      b.maxLng >= viewportMinLng &&
      b.minLng <= viewportMaxLng &&
      b.maxLat >= viewportMinLat &&
      b.minLat <= viewportMaxLat;
    if (!intersects) continue;

    const outerRings = extractOuterRings(territory.geojson_json);
    if (outerRings.length === 0) continue;

    for (const ring of outerRings) {
      if (ring.length < 4) continue;
      
      // 降采样绘制：根据 stride 抽稀点
      const downsampledRing: [number, number][] = [];
      for (let i = 0; i < ring.length; i += stride) {
        downsampledRing.push(ring[i]);
      }
      // 确保闭合
      if (downsampledRing.length > 0 && downsampledRing[downsampledRing.length - 1] !== ring[0]) {
        downsampledRing.push(ring[0]);
      }
      
      const pixels = downsampledRing
        .map(([lng, lat]) => {
          const pixel = map.lngLatToContainer?.(new AMapGlobal.LngLat(lng, lat));
          if (!pixel) return null;
          return { x: Number(pixel.x), y: Number(pixel.y) };
        })
        .filter((pt): pt is { x: number; y: number } => pt !== null && Number.isFinite(pt.x) && Number.isFinite(pt.y));

      if (pixels.length < 3) continue;

      ctx.beginPath();
      ctx.moveTo(pixels[0].x, pixels[0].y);
      for (let i = 1; i < pixels.length; i += 1) {
        ctx.lineTo(pixels[i].x, pixels[i].y);
      }
      ctx.closePath();
      let minPx = Infinity;
      let maxPx = -Infinity;
      let minPy = Infinity;
      let maxPy = -Infinity;
      for (const { x, y } of pixels) {
        if (x < minPx) minPx = x;
        if (x > maxPx) maxPx = x;
        if (y < minPy) minPy = y;
        if (y > maxPy) maxPy = y;
      }
      const pixelW = maxPx - minPx;
      const pixelH = maxPy - minPy;
      const pixelArea = pixelW * pixelH;

      const useAvatarTiles =
        territory.isClubMode &&
        Boolean(territory.clubAvatarUrl) &&
        pixelArea >= PIXEL_AREA_THRESHOLD;

      if (useAvatarTiles) {
        const avatarUrl = territory.clubAvatarUrl as string;
        const cachedImg = getOrLoadImage(avatarUrl, () => {
          onNeedRedraw?.();
        });

        if (cachedImg) {
          const tileSize = Math.min(128, Math.max(32, Math.round(pixelW * 0.3)));
          const avatarTile = getRoundedAvatarTile(avatarUrl, cachedImg, tileSize);
          const startX = Math.floor(minPx / tileSize) * tileSize;
          const startY = Math.floor(minPy / tileSize) * tileSize;

          ctx.save();
          ctx.globalAlpha = territory.fillOpacity;
          // clip() applies to the ring path created above, keeping avatar tiles inside the territory boundary.
          ctx.clip();
          for (let x = startX; x <= maxPx; x += tileSize) {
            for (let y = startY; y <= maxPy; y += tileSize) {
              ctx.drawImage(avatarTile, x, y);
            }
          }
          ctx.restore();
        } else {
          ctx.fillStyle = territory.fillColor || "rgba(251, 146, 60, 0.5)";
          ctx.globalAlpha = territory.fillOpacity;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      } else {
        ctx.fillStyle = territory.fillColor || "rgba(251, 146, 60, 0.5)";
        ctx.globalAlpha = territory.fillOpacity;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      ctx.strokeStyle = territory.strokeColor || "rgba(234, 88, 12, 0.8)";
      ctx.lineWidth = territory.strokeWeight || 1.5;
      ctx.stroke();
    }
  }

  renderTerritoryLabels(ctx, map, territories, viewportMinLng, viewportMaxLng, viewportMinLat, viewportMaxLat, currentZoom, ownerProfileMap || new Map());
}

const TerritoryLayer: React.FC<TerritoryLayerProps> = ({
  map,
  isVisible,
  kingdomMode,
  showFactionColors = false,
  viewMode: propViewMode,
  onViewportKingChange,
  currentZoom = 13,
}) => {
  const { currentCity: city } = useCity();
  const { viewMode: contextViewMode, setSelectedTerritory, setIsDetailSheetOpen } = useMapInteraction();
  const resolvedViewMode = propViewMode ?? contextViewMode;
  const { user } = useAuth();
  const { territoryAppearance } = useGameTerritoryAppearance();
  const clubId = useGameStore((state) => state.clubId);
  const faction = useGameStore((state) => state.faction);
  const setSelectedTerritoryId = useGameStore((state) => state.setSelectedTerritoryId);

  const customLayerRef = useRef<{ setMap: (target: unknown) => void; render?: () => void } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const mapInteractingRef = useRef(false);
  const rawTerritoriesRef = useRef<ExtTerritory[]>([]);
  const territoriesDataRef = useRef<TerritoryWithRender[]>([]);
  const ownerProfileMapRef = useRef<Map<string, { nickname: string; avatarUrl: string | null }>>(new Map());
  const clubAvatarMapRef = useRef<Map<string, string | null>>(new Map());
  
  // 网络请求锁：防止竞态条件和请求风暴
  const abortControllerRef = useRef<AbortController | null>(null);
  const isLoadingRef = useRef<boolean>(false);
  
  // 性能优化：缓存渲染结果，避免不必要的重绘
  const lastRenderDataRef = useRef<{
    territoriesHash: string;
    canvasSize: { width: number; height: number };
    mapZoom: number;
    mapCenter: [number, number];
  } | null>(null);
  
  // 防抖渲染，避免高频更新
  const renderDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const resolveFactionColor = useCallback((ownerFaction: string | null | undefined): string => {
    if (!ownerFaction) return "#64748b";
    if (ownerFaction === "Red" || ownerFaction === "RED") return "#ef4444";
    if (ownerFaction === "Blue" || ownerFaction === "BLUE") return "#3b82f6";
    const key = ownerFaction.toLowerCase().trim();
    if (key.includes("blue") || key.includes("azure") || key.includes("cyan") || key.includes("water")) return "#3b82f6";
    if (key.includes("red") || key.includes("crimson") || key.includes("scarlet") || key.includes("fire")) return "#ef4444";
    if (key.includes("green") || key.includes("emerald")) return "#22c55e";
    if (key.includes("purple") || key.includes("violet")) return "#a855f7";
    return "#64748b";
  }, []);

  const buildPolygonPresentation = useCallback((territory: ExtTerritory) => {
    const territoryHealth = territory.health ?? territory.maxHealth ?? 100;
    const isLowHealth = territoryHealth < 50;

    if (kingdomMode === "club") {
      const isSelfClub = Boolean(clubId && territory.ownerClubId && territory.ownerClubId === clubId);
      const hasClub = Boolean(territory.ownerClubId);
      const palette = isSelfClub ? CLUB_COLORS.self : hasClub ? CLUB_COLORS.enemy : CLUB_COLORS.neutral;
      return {
        fillColor: isLowHealth ? "#facc15" : palette.fill,
        fillOpacity: isLowHealth ? 0.2 : palette.fillOpacity,
        strokeColor: isLowHealth ? "#facc15" : palette.stroke,
        strokeWeight: isSelfClub ? 2.5 : 1.5,
      };
    }

    const ctx: ViewContext = {
      userId: user?.id || null,
      clubId: clubId || null,
      faction: faction || null,
      subject: resolvedViewMode === "faction" ? "faction" : "individual",
    };

    const style = generateTerritoryStyle(territory, ctx);
    const isFactionColorActive = showFactionColors || resolvedViewMode === "faction";
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

    const specificFillColor = (territory as ExtTerritory & { ownerFillColor?: string }).ownerFillColor;
    const specificStrokeColor = (territory as ExtTerritory & { ownerPathColor?: string }).ownerPathColor;

    const fillColor = allowCustomAppearance
      ? territoryAppearance.fillColor || DEFAULT_FILL
      : isFactionColorActive
        ? safeColor(factionBaseColor, DEFAULT_FILL)
        : specificFillColor || (style as { fillColor?: string; fillColor2D?: string }).fillColor || style.fillColor2D || DEFAULT_FILL;

    const baseStrokeColor = allowCustomAppearance
      ? territoryAppearance.strokeColor || DEFAULT_STROKE
      : isFactionColorActive
        ? (factionVisuals as { strokeColor?: string }).strokeColor || factionBaseColor || DEFAULT_STROKE
        : specificStrokeColor || (style as { strokeColor?: string; strokeColor2D?: string }).strokeColor || style.strokeColor2D || DEFAULT_STROKE;

    return {
      fillColor,
      fillOpacity: allowCustomAppearance ? territoryAppearance.fillOpacity : (isLowHealth ? 0.2 : 0.5),
      strokeColor: isLowHealth ? "#facc15" : baseStrokeColor,
      strokeWeight: isLowHealth ? 2.5 : 1.5,
    };
  }, [clubId, faction, kingdomMode, resolvedViewMode, resolveFactionColor, showFactionColors, territoryAppearance.fillColor, territoryAppearance.fillOpacity, territoryAppearance.strokeColor, user?.id]);

  const decorateTerritories = useCallback((items: ExtTerritory[]) => {
    territoriesDataRef.current = items
      .filter((item) => item.id && item.ownerId && item.geojson_json)
      .map((item) => {
        const presentation = buildPolygonPresentation(item);
        const rings = extractOuterRings(item.geojson_json);
        let bbox = { minLng: 0, maxLng: 0, minLat: 0, maxLat: 0 };
        let areaM2 = 0;

        if (rings.length > 0) {
          bbox = computeRingBBox(rings[0]);
          try {
            const poly = turf.polygon([rings[0]]);
            areaM2 = turf.area(poly);
          } catch {
            areaM2 = 0;
          }
        }

        return {
          ...item,
          fillColor: safeColor(presentation.fillColor, DEFAULT_FILL),
          strokeColor: safeColor(presentation.strokeColor, DEFAULT_STROKE),
          fillOpacity: presentation.fillOpacity,
          strokeWeight: presentation.strokeWeight,
          areaM2,
          bbox,
          clubAvatarUrl: item.ownerClubId ? (clubAvatarMapRef.current.get(item.ownerClubId) ?? null) : null,
          isClubMode: kingdomMode === "club",
        };
      });
  }, [buildPolygonPresentation, kingdomMode]);

  const recomputeViewportKing = useCallback(() => {
    if (!map || !onViewportKingChange) return;
    const bounds = map.getBounds?.();
    if (!bounds) {
      onViewportKingChange(null);
      return;
    }

    const northEast = bounds.getNorthEast?.();
    const southWest = bounds.getSouthWest?.();
    if (!northEast || !southWest) {
      onViewportKingChange(null);
      return;
    }

    const viewportMinLng = southWest.getLng();
    const viewportMaxLng = northEast.getLng();
    const viewportMinLat = southWest.getLat();
    const viewportMaxLat = northEast.getLat();

    const totals = new Map<string, number>();
    for (const territory of territoriesDataRef.current) {
      if (!territory.ownerId) continue;
      const b = territory.bbox;
      const intersects =
        b.maxLng >= viewportMinLng &&
        b.minLng <= viewportMaxLng &&
        b.maxLat >= viewportMinLat &&
        b.minLat <= viewportMaxLat;
      if (!intersects) continue;
      totals.set(territory.ownerId, (totals.get(territory.ownerId) || 0) + (territory.areaM2 || 0));
    }

    let kingOwnerId = "";
    let maxArea = 0;
    totals.forEach((area, ownerId) => {
      if (area > maxArea) {
        maxArea = area;
        kingOwnerId = ownerId;
      }
    });

    if (kingOwnerId === "") {
      onViewportKingChange(null);
      return;
    }

    const profile = ownerProfileMapRef.current.get(kingOwnerId);
    onViewportKingChange({
      ownerId: kingOwnerId,
      nickname: profile?.nickname && profile.nickname.trim() !== "" ? profile.nickname.trim() : `领主-${kingOwnerId.slice(0, 6)}`,
      avatarUrl: profile?.avatarUrl || null,
      totalArea: maxArea,
    });
  }, [map, onViewportKingChange]);

  const redrawCanvas = useCallback(() => {
    if (!map || !canvasRef.current || !isVisible) return;
    
    // 性能优化：检查是否需要重绘
    const currentZoom = map.getZoom?.() || 0;
    const currentCenter = map.getCenter?.() || [0, 0];
    const territoriesHash = JSON.stringify(territoriesDataRef.current.map(t => t.id));
    
    // 检查缓存是否有效
    if (lastRenderDataRef.current) {
      const { territoriesHash: lastHash, canvasSize, mapZoom, mapCenter } = lastRenderDataRef.current;
      
      // 如果领地数据、画布尺寸、缩放级别、中心点都未变化，则跳过重绘
      if (territoriesHash === lastHash && 
          canvasSize.width === canvasSizeRef.current.width && 
          canvasSize.height === canvasSizeRef.current.height &&
          Math.abs(mapZoom - currentZoom) < 0.1 &&
          Math.abs(mapCenter[0] - currentCenter[0]) < 0.0001 &&
          Math.abs(mapCenter[1] - currentCenter[1]) < 0.0001) {
        return;
      }
    }
    
    // 防抖处理：取消之前的渲染任务
    if (renderDebounceRef.current) {
      clearTimeout(renderDebounceRef.current);
    }
    
    // 延迟渲染，避免高频更新
    renderDebounceRef.current = setTimeout(() => {
      renderTerritoriesOnCanvas(
        canvasRef.current!,
        map,
        territoriesDataRef.current,
        canvasSizeRef,
        () => {
          if (!mapInteractingRef.current && canvasRef.current) {
            renderTerritoriesOnCanvas(canvasRef.current, map, territoriesDataRef.current, canvasSizeRef, undefined, ownerProfileMapRef.current);
          }
        },
        ownerProfileMapRef.current
      );
      
      // 更新缓存
      lastRenderDataRef.current = {
        territoriesHash,
        canvasSize: { ...canvasSizeRef.current },
        mapZoom: currentZoom,
        mapCenter: [currentCenter[0], currentCenter[1]] as [number, number]
      };
      
      renderDebounceRef.current = null;
    }, 16); // 约60fps
  }, [isVisible, map]);

  const loadTerritories = useCallback(async () => {
    if (!map || !city) return;
    
    // 先取消旧请求（无论是否在加载中）
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // 创建新的 AbortController
    const controller = new AbortController();
    abortControllerRef.current = controller;
    isLoadingRef.current = true;
    
    try {
      const rawData = await fetchTerritories(city.id, controller.signal);
      
      // 检查请求是否被取消
      if (controller.signal.aborted) {
        return;
      }
      
      rawTerritoriesRef.current = Array.isArray(rawData) ? rawData : [];
      const supabase = createClient();

      const ownerIds = Array.from(
        new Set(rawTerritoriesRef.current.map((item) => item.ownerId).filter((id): id is string => Boolean(id)))
      );

      const clubIds = Array.from(
        new Set(rawTerritoriesRef.current.map((item) => item.ownerClubId).filter((id): id is string => Boolean(id)))
      );

      const [profiles, clubs] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, nickname, avatar_url")
          .in("id", ownerIds)
          .then(({ data, error }) => {
            if (error) {
              console.error("Failed to fetch profiles:", error);
              return [];
            }
            return data || [];
          }),
        supabase
          .from("clubs")
          .select("id, avatar_url")
          .in("id", clubIds)
          .then(({ data, error }) => {
            if (error) {
              console.error("Failed to fetch clubs:", error);
              return [];
            }
            return data || [];
          }),
      ]);

      // 再次检查请求是否被取消
      if (controller.signal.aborted) {
        return;
      }

      ownerProfileMapRef.current = new Map(
        profiles.map((p: OwnerProfile) => [p.id, { 
          nickname: p.nickname && p.nickname.trim() !== "" ? p.nickname.trim() : `领主-${p.id.slice(0, 6)}`,
          avatarUrl: p.avatar_url || null 
        }])
      );

      clubAvatarMapRef.current = new Map(clubs.map((c: { id: string; avatar_url: string | null }) => [c.id, c.avatar_url]));

      decorateTerritories(rawTerritoriesRef.current);
      customLayerRef.current?.render?.();
      recomputeViewportKing();
      logEvent("territory_render_success", { cityId: city.id, count: territoriesDataRef.current.length });
    } catch (error: unknown) {
      // 忽略取消请求的错误
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      const knownError = error as { name?: string; digest?: string; message?: string };
      if (knownError?.name !== "AbortError" && knownError?.digest !== "NEXT_REDIRECT") {
        logEvent("territory_render_retry", { error: knownError?.message || "unknown" });
      }
    } finally {
      isLoadingRef.current = false;
    }
  }, [city, decorateTerritories, map, recomputeViewportKing]);

  useEffect(() => {
    if (!map) return;

    const canvas = document.createElement("canvas");
    canvasRef.current = canvas;

    const AMapGlobal = (window as typeof window & {
      AMap?: {
        CustomLayer: new (
          canvasNode: HTMLCanvasElement,
          opts: { zIndex: number; opacity: number }
        ) => { setMap: (target: unknown) => void; render?: () => void };
      };
    }).AMap;
    if (!AMapGlobal?.CustomLayer) return;

    const customLayer = new AMapGlobal.CustomLayer(canvas, { zIndex: 120, opacity: 1 });

    customLayer.render = () => {
      if (mapInteractingRef.current) return;
      redrawCanvas();
    };

    customLayer.setMap(isVisible ? map : null);
    customLayerRef.current = customLayer;

    return () => {
      // 清理防抖定时器
      if (renderDebounceRef.current) {
        clearTimeout(renderDebounceRef.current);
        renderDebounceRef.current = null;
      }
      
      // 清理缓存
      lastRenderDataRef.current = null;
      
      // 清理 Canvas 资源
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
      
      customLayer.setMap(null);
      customLayerRef.current = null;
      canvasRef.current = null;
      canvasSizeRef.current = { width: 0, height: 0 };
    };
  }, [isVisible, map, redrawCanvas]);

  useEffect(() => {
    if (!map) return;

    const handleRefresh = () => {
      loadTerritories();
    };

    const handleMoveStart = () => {
      mapInteractingRef.current = true;
    };

    const handleMoveEnd = () => {
      mapInteractingRef.current = false;
      customLayerRef.current?.render?.();
      recomputeViewportKing();
    };

    map.on("movestart", handleMoveStart);
    map.on("zoomstart", handleMoveStart);
    map.on("dragstart", handleMoveStart);
    map.on("moveend", handleMoveEnd);
    map.on("zoomend", handleMoveEnd);

    window.addEventListener("citylord:refresh-territories", handleRefresh);
    loadTerritories();

    return () => {
      // 清理悬挂的网络请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      isLoadingRef.current = false;
      
      map.off("movestart", handleMoveStart);
      map.off("zoomstart", handleMoveStart);
      map.off("dragstart", handleMoveStart);
      map.off("moveend", handleMoveEnd);
      map.off("zoomend", handleMoveEnd);
      window.removeEventListener("citylord:refresh-territories", handleRefresh);
    };
  }, [loadTerritories, map, recomputeViewportKing]);

  useEffect(() => {
    decorateTerritories(rawTerritoriesRef.current);
    customLayerRef.current?.render?.();
    recomputeViewportKing();
  }, [decorateTerritories, recomputeViewportKing]);

  useEffect(() => {
    if (!map) return;

    const handleMapClick = (e: { lnglat?: { getLng: () => number; getLat: () => number } }) => {
      const lngLat = e?.lnglat;
      if (!lngLat) {
        setSelectedTerritory?.(null);
        setSelectedTerritoryId(null as never);
        setIsDetailSheetOpen?.(false);
        return;
      }

      const clickLng = lngLat.getLng();
      const clickLat = lngLat.getLat();
      const clicked = territoriesDataRef.current.find((territory) => {
        const b = territory.bbox;
        if (
          clickLng < b.minLng ||
          clickLng > b.maxLng ||
          clickLat < b.minLat ||
          clickLat > b.maxLat
        ) {
          return false;
        }
        const rings = extractOuterRings(territory.geojson_json);
        if (rings.length === 0) return false;
        try {
          const point = turf.point([clickLng, clickLat]);
          const polygon = turf.polygon([rings[0]]);
          return turf.booleanPointInPolygon(point, polygon);
        } catch {
          return false;
        }
      });

      if (clicked) {
        setSelectedTerritoryId(clicked.id as never);
        setSelectedTerritory?.(clicked);
        setIsDetailSheetOpen?.(true);
      } else {
        setSelectedTerritory?.(null);
        setSelectedTerritoryId(null as never);
        setIsDetailSheetOpen?.(false);
      }
    };

    map.on("click", handleMapClick);
    return () => {
      map.off("click", handleMapClick);
    };
  }, [map, setIsDetailSheetOpen, setSelectedTerritory, setSelectedTerritoryId]);

  useEffect(() => {
    if (!customLayerRef.current) return;
    
    const shouldShow = isVisible && currentZoom >= 10;
    
    customLayerRef.current.setMap(shouldShow ? map : null);
    if (shouldShow) {
      customLayerRef.current.render?.();
    } else {
      onViewportKingChange?.(null);
    }
  }, [isVisible, map, onViewportKingChange, currentZoom]);

  return null;
};

export default TerritoryLayer;
