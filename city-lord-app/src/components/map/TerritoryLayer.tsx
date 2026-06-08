"use client";

import { useEffect, useRef, useCallback } from 'react';
import { logEvent } from '@/lib/native-log';
import type { ExtTerritory } from "@/types/city";
import { useCity } from '@/contexts/CityContext';
import { useMapInteraction } from './MapInteractionContext';
import { calculateHealthVisuals, generateTerritoryStyle } from '@/lib/citylord/territory-renderer';
import { type ViewContext } from '@/types/city';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import type { ViewportKingData } from "./AMapView";
import * as turf from "@turf/turf";
import { apiFetch } from "@/lib/fetch-shim";
import { useGameStore, useGameTerritoryAppearance } from '@/store/useGameStore';
import { getTerritoryDisplayName } from '@/lib/territory-display';
import { useMapDisplayStore, type MapDisplayMode } from '@/store/useMapDisplayStore';
import { useMapInteractionStore } from '@/store/useMapInteractionStore';

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
  centerPoint: [number, number];
  gridPoints: [number, number][];
  clubAvatarUrl: string | null;
  isClubMode: boolean;
};

interface TerritoryLayerProps {
  map: any | null;
  isVisible: boolean;
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
    let combinedSignal = timeoutController.signal;
    if (externalSignal) {
      if (typeof AbortSignal !== "undefined" && "any" in AbortSignal && typeof (AbortSignal as any).any === "function") {
        combinedSignal = (AbortSignal as any).any([externalSignal, timeoutController.signal]);
      } else {
        const controller = new AbortController();
        const onAbort = () => {
          try { controller.abort(); } catch {}
        };
        if (externalSignal.aborted || timeoutController.signal.aborted) {
          controller.abort();
        } else {
          externalSignal.addEventListener("abort", onAbort);
          timeoutController.signal.addEventListener("abort", onAbort);
        }
        combinedSignal = controller.signal;
      }
    }
    const { signal: _drop, ...restInit } = init ?? {};
    return await apiFetch(url, { ...restInit, signal: combinedSignal });
  } finally {
    clearTimeout(timer);
  }
};

const fetchTerritories = async (
  cityId: string,
  signal?: AbortSignal
): Promise<ExtTerritory[]> => {
  const url = `/api/city/fetch-territories?cityId=${cityId}`;
  console.log(`🔮 [fetchTerritories] Requesting: ${url}`);
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

class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private readonly maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

const imageCache = new LRUCache<string, HTMLImageElement | "loading" | "error">(150);
const avatarTileCache = new LRUCache<string, HTMLCanvasElement>(300);

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

function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return Math.abs(hash);
}

function deterministicShuffle<T>(array: T[], seedStr: string): T[] {
  const arr = [...array];
  let seed = hashString(seedStr);
  for (let i = arr.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const j = seed % (i + 1);
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}

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
  ownerProfileMap: Map<string, { nickname: string; avatarUrl: string | null }>,
  currentUserId?: string | null
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
      customName: territory.customName ?? null,
      clubName: undefined,
      ownerNickname: ownerProfile?.nickname ?? null,
      ownerId: territory.ownerId ?? null,
      currentUserId: currentUserId ?? null
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
  ownerProfileMap?: Map<string, { nickname: string; avatarUrl: string | null }>,
  selectedTerritoryId?: string | null,
  currentUserId?: string | null
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

  // 1. 过滤出被选中的聚焦领地以执行末尾叠加绘制，防止 Z-index 压盖
  let focusedTerritory: TerritoryWithRender | null = null;
  const normalTerritories: TerritoryWithRender[] = [];
  
  for (const t of territories) {
    if (selectedTerritoryId && t.id === selectedTerritoryId) {
      focusedTerritory = t;
    } else {
      normalTerritories.push(t);
    }
  }

  for (const territory of normalTerritories) {
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

      // 步骤1：构建包含所有 ring 的复合 Path（一次 beginPath）
      ctx.beginPath();
      for (const ring of outerRings) {
        const activeStrokeStride = ring.length < 30 ? 1 : stride;
        const sampledRing = ring.filter((_, i) => i % activeStrokeStride === 0 || i === ring.length - 1);
        const pixels = sampledRing.map(([lng, lat]) => {
          const pixel = map.lngLatToContainer?.(new AMapGlobal.LngLat(lng, lat));
          return pixel ? { x: Number(pixel.x), y: Number(pixel.y) } : null;
        }).filter((pt): pt is { x: number; y: number } => pt !== null && Number.isFinite(pt.x) && Number.isFinite(pt.y));

        if (pixels.length < 3) continue;
        ctx.moveTo(pixels[0].x, pixels[0].y);
        for (let i = 1; i < pixels.length; i++) ctx.lineTo(pixels[i].x, pixels[i].y);
        ctx.closePath();
      }

      // 步骤2：用 evenodd 规则填充 → 奇偶相消，内部重叠区域自动清空
      ctx.fillStyle = territory.fillColor || "rgba(251, 146, 60, 0.5)";
      ctx.globalAlpha = territory.fillOpacity;
      ctx.fill('evenodd');

      // 步骤3：描边只走一次，无任何 Turf 调用
      ctx.globalAlpha = 1;
      ctx.strokeStyle = territory.strokeColor || "rgba(234, 88, 12, 0.8)";
      ctx.lineWidth = territory.strokeWeight || 1.5;
      ctx.stroke();

      const hasAvatar = territory.isClubMode && Boolean(territory.clubAvatarUrl);
      if (hasAvatar) {
        const avatarUrl = territory.clubAvatarUrl as string;
        const cachedImg = getOrLoadImage(avatarUrl, () => {
          onNeedRedraw?.();
        });

        if (cachedImg) {
          let discreteSize: number;
          if (currentZoom < 13) {
            discreteSize = 60; // originally 24
          } else if (currentZoom < 15) {
            discreteSize = 80; // originally 32
          } else if (currentZoom < 17) {
            discreteSize = 120; // originally 48
          } else {
            discreteSize = 160; // originally 64
          }

          const avatarTile = getRoundedAvatarTile(avatarUrl, cachedImg, discreteSize);
          const pattern = ctx.createPattern(avatarTile, 'repeat');
          
          if (pattern) {
            const originPoint = map.lngLatToContainer?.(new AMapGlobal.LngLat(territory.centerPoint[0], territory.centerPoint[1]));
            if (originPoint && Number.isFinite(originPoint.x) && Number.isFinite(originPoint.y)) {
              const matrix = new DOMMatrix();
              matrix.translateSelf(originPoint.x - discreteSize / 2, originPoint.y - discreteSize / 2);
              pattern.setTransform(matrix);
            }

            ctx.save();
            ctx.clip('evenodd');
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = pattern;
            ctx.fill('evenodd');
            ctx.restore();
          }
        }
      }
    }

  // 🟢 2. 渲染聚焦高亮的领地，应用亮金色辉光和双层高对比度描边（乐观剔除、末尾叠加）
  if (focusedTerritory) {
    const outerRings = extractOuterRings(focusedTerritory.geojson_json);
    if (outerRings.length > 0) {
      ctx.save();
      ctx.beginPath();
      for (const ring of outerRings) {
        const pixels = ring
          .map(([lng, lat]) => {
            const pixel = map.lngLatToContainer?.(new AMapGlobal.LngLat(lng, lat));
            return pixel ? { x: Number(pixel.x), y: Number(pixel.y) } : null;
          })
          .filter((pt): pt is { x: number; y: number } => pt !== null && Number.isFinite(pt.x) && Number.isFinite(pt.y));

        if (pixels.length < 3) continue;

        ctx.moveTo(pixels[0].x, pixels[0].y);
        for (let i = 1; i < pixels.length; i += 1) {
          ctx.lineTo(pixels[i].x, pixels[i].y);
        }
        ctx.closePath();
      }

      // 1. 金色辉光发光效果 (Glow Effect)
      ctx.shadowColor = "rgba(245, 158, 11, 0.85)";
      ctx.shadowBlur = 15;

      // 2. 填充底色（使用 evenodd 规则清空交叉，保持高亮透明度）
      ctx.fillStyle = focusedTerritory.fillColor || "rgba(251, 146, 60, 0.6)";
      ctx.globalAlpha = Math.min(1.0, focusedTerritory.fillOpacity + 0.15);
      ctx.fill('evenodd');
      ctx.shadowBlur = 0; // Turn off shadow momentarily
      
      // 3. 白色粗描边 (Outer boundary line)
      ctx.globalAlpha = 1.0;
      ctx.shadowColor = "rgba(245, 158, 11, 0.85)";
      ctx.shadowBlur = 15; // Restore glow
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 4.5;
      ctx.stroke();

      // 4. 辅助金色内边框线条 (Gold line)
      ctx.shadowBlur = 0; // 关闭阴影保证内圈锐利
      ctx.strokeStyle = "#F59E0B";
      ctx.lineWidth = 2.0;
      ctx.stroke();

      ctx.restore();

        // 同时渲染头像（如果俱乐部模式有头像的话，也以末尾叠加的方式画出来）
        const hasAvatar = focusedTerritory.isClubMode && Boolean(focusedTerritory.clubAvatarUrl);
        if (hasAvatar) {
          const avatarUrl = focusedTerritory.clubAvatarUrl as string;
          const cachedImg = getOrLoadImage(avatarUrl, () => {
            onNeedRedraw?.();
          });

          if (cachedImg) {
            let discreteSize: number;
            if (currentZoom < 13) {
              discreteSize = 60; // originally 24
            } else if (currentZoom < 15) {
              discreteSize = 80; // originally 32
            } else if (currentZoom < 17) {
              discreteSize = 120; // originally 48
            } else {
              discreteSize = 160; // originally 64
            }

            const avatarTile = getRoundedAvatarTile(avatarUrl, cachedImg, discreteSize);
            const pattern = ctx.createPattern(avatarTile, 'repeat');
            
            if (pattern) {
              const originPoint = map.lngLatToContainer?.(new AMapGlobal.LngLat(focusedTerritory.centerPoint[0], focusedTerritory.centerPoint[1]));
              if (originPoint && Number.isFinite(originPoint.x) && Number.isFinite(originPoint.y)) {
                const matrix = new DOMMatrix();
                matrix.translateSelf(originPoint.x - discreteSize / 2, originPoint.y - discreteSize / 2);
                pattern.setTransform(matrix);
              }

              ctx.save();
              // Re-create the path for clipping since we might be in a different state
              ctx.beginPath();
              for (const ring of outerRings) {
                const pixels = ring
                  .map(([lng, lat]) => {
                    const pixel = map.lngLatToContainer?.(new AMapGlobal.LngLat(lng, lat));
                    return pixel ? { x: Number(pixel.x), y: Number(pixel.y) } : null;
                  })
                  .filter((pt): pt is { x: number; y: number } => pt !== null && Number.isFinite(pt.x) && Number.isFinite(pt.y));

                if (pixels.length < 3) continue;

                ctx.moveTo(pixels[0].x, pixels[0].y);
                for (let i = 1; i < pixels.length; i += 1) {
                  ctx.lineTo(pixels[i].x, pixels[i].y);
                }
                ctx.closePath();
              }
              ctx.clip('evenodd');
              ctx.globalAlpha = 0.85;
              ctx.fillStyle = pattern;
              ctx.fill('evenodd');
              ctx.restore();
            }
          }
        }
      }
    }

  if (ownerProfileMap) {
    // Determine context value equivalent locally to skip label rendering if not in territory/personal or club modes.
    // However, if we only hide it when specifically instructed, we can just ensure the caller sets the logic correctly.
    // The reviewer recommended checking displayMode. But displayMode variable is not cleanly available right here.
    // We already removed clubName from rendering explicitly via `clubName: undefined`.
    // It is safe to just leave renderTerritoryLabels.
    renderTerritoryLabels(ctx, map, territories, viewportMinLng, viewportMaxLng, viewportMinLat, viewportMaxLat, currentZoom, ownerProfileMap, currentUserId);
  }
}

const TerritoryLayer: React.FC<TerritoryLayerProps> = ({
  map,
  isVisible,
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
  const selectedTerritoryId = useGameStore((state) => state.selectedTerritoryId);
  const { mapDisplayMode } = useMapDisplayStore();

  const selectedTerritoryIdRef = useRef<string | null>(null);
  const customLayerRef = useRef<{ setMap: (target: unknown) => void; render?: () => void } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  const isVisibleRef = useRef(isVisible);
  const pendingRefreshRef = useRef(false);
  const processingBatchIdRef = useRef<number>(0);

  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  // 监听选中领地 ID 的变化，实时更新 ref 并手动触发 Canvas 重绘，避免重建 CustomLayer 导致闪烁
  useEffect(() => {
    selectedTerritoryIdRef.current = selectedTerritoryId;
    if (customLayerRef.current) {
      customLayerRef.current.render?.();
    }
  }, [selectedTerritoryId]);
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
  // P0-2 FIX: RAF ref
  const redrawRAFRef = useRef<number | null>(null);

  const loadTerritoriesRef = useRef<() => void>();
  const redrawCanvasRef = useRef<() => void>();
  const recomputeViewportKingRef = useRef<() => void>();

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

    if (mapDisplayMode === "club") {
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
    const isFactionColorActive = mapDisplayMode === "faction";
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
  }, [clubId, faction, mapDisplayMode, resolvedViewMode, resolveFactionColor, territoryAppearance.fillColor, territoryAppearance.fillOpacity, territoryAppearance.strokeColor, user?.id]);

  const recomputeViewportKing = useCallback(() => {
    if (!map || !onViewportKingChange) return;
    
    // 当视野拉大到能看到两个市区时（zoom < 11.5），隐藏区域霸主横条
    const currentZoom = map.getZoom?.() || 0;
    if (currentZoom < 11.5) {
      onViewportKingChange(null);
      return;
    }

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

  const decorateTerritoriesAsync = useCallback(async (items: ExtTerritory[]) => {
    const batchId = ++processingBatchIdRef.current;
    const filteredItems = items.filter((item) => item.id && item.ownerId && item.geojson_json);
    const result: TerritoryWithRender[] = [];
    const chunkSize = 20;

    for (let index = 0; index < filteredItems.length; index += chunkSize) {
      if (batchId !== processingBatchIdRef.current) return;

      const chunk = filteredItems.slice(index, index + chunkSize);
      const decoratedChunk = chunk.map((item) => {
        const presentation = buildPolygonPresentation(item);
        const rings = extractOuterRings(item.geojson_json);
        let bbox = { minLng: 0, maxLng: 0, minLat: 0, maxLat: 0 };
        let areaM2 = 0;
        let centerPoint: [number, number] = [0, 0];
        let gridPoints: [number, number][] = [];

        if (rings.length > 0) {
          const ring = rings[0];
          bbox = computeRingBBox(ring);
          try {
            const poly = turf.polygon([ring]);
            areaM2 = turf.area(poly);

            // 1. Calculate centroid without booleanPointInPolygon check
            let centroid: any;
            let centerVal: [number, number] | null = null;
            try {
              centroid = turf.centroid(poly);
              if (centroid && centroid.geometry && centroid.geometry.coordinates) {
                centerVal = centroid.geometry.coordinates as [number, number];
              }
            } catch (e) {
              console.error("Centroid calculation failed", e);
            }

            // 2. Fallback to centerOfMass
            if (!centerVal) {
              try {
                const com = turf.centerOfMass(poly);
                if (com && com.geometry && com.geometry.coordinates) {
                  centerVal = com.geometry.coordinates as [number, number];
                }
              } catch (e) {
                console.error("Center of mass calculation failed", e);
              }
            }

            // 3. Fallback to first coordinate of outer ring
            if (!centerVal) {
              centerVal = [ring[0][0], ring[0][1]];
            }

            centerPoint = centerVal;

            // Generate deterministic grid points inside BBox without running PIP (booleanPointInPolygon)
            const candidates: [number, number][] = [];
            const steps = 5; // 5x5 grid
            const dLng = (bbox.maxLng - bbox.minLng) / (steps + 1);
            const dLat = (bbox.maxLat - bbox.minLat) / (steps + 1);

            for (let i = 1; i <= steps; i++) {
              for (let j = 1; j <= steps; j++) {
                const lng = bbox.minLng + i * dLng;
                const lat = bbox.minLat + j * dLat;
                const distToCenterSq = Math.pow(lng - centerPoint[0], 2) + Math.pow(lat - centerPoint[1], 2);
                if (distToCenterSq > 1e-12) {
                  candidates.push([lng, lat]);
                }
              }
            }

            // Sort candidates by distance to centerPoint
            candidates.sort((a, b) => {
              const distA = Math.pow(a[0] - centerPoint[0], 2) + Math.pow(a[1] - centerPoint[1], 2);
              const distB = Math.pow(b[0] - centerPoint[0], 2) + Math.pow(b[1] - centerPoint[1], 2);
              return distA - distB;
            });

            gridPoints = candidates.slice(0, 12);
            } catch (e) {
            console.error("Territory geometry processing failed", e);
            areaM2 = 0;
            centerPoint = [(bbox.minLng + bbox.maxLng) / 2, (bbox.minLat + bbox.maxLat) / 2];
            gridPoints = [];
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
          centerPoint,
          gridPoints,
          clubAvatarUrl: item.ownerClubId ? (clubAvatarMapRef.current.get(item.ownerClubId) ?? null) : null,
          isClubMode: mapDisplayMode === "club",
        };
      });

      result.push(...decoratedChunk);

      // Yield main thread using requestAnimationFrame
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    }

    if (batchId === processingBatchIdRef.current) {
      territoriesDataRef.current = result;
      // Triggers redraw
      lastRenderDataRef.current = null;
      customLayerRef.current?.render?.();
      recomputeViewportKing();
    }
  }, [buildPolygonPresentation, mapDisplayMode, recomputeViewportKing]);

  const redrawCanvas = useCallback(() => {
    if (!map || !canvasRef.current || !isVisible) return;
    
    // P0-2 FIX: RAF throttle lock to prevent main thread blocking
    if (redrawRAFRef.current !== null) return; // Already scheduled
    
    redrawRAFRef.current = requestAnimationFrame(() => {
      redrawRAFRef.current = null;
      
      const currentZoom = map.getZoom?.() || 0;
      const currentCenter = map.getCenter?.();
      const centerLng = currentCenter
        ? (typeof currentCenter.getLng === 'function'
            ? currentCenter.getLng()
            : (typeof currentCenter.lng === 'number'
                ? currentCenter.lng
                : (Array.isArray(currentCenter) ? currentCenter[0] : 0)))
        : 0;

      const centerLat = currentCenter
        ? (typeof currentCenter.getLat === 'function'
            ? currentCenter.getLat()
            : (typeof currentCenter.lat === 'number'
                ? currentCenter.lat
                : (Array.isArray(currentCenter) ? currentCenter[1] : 0)))
        : 0;
      
      const territoriesHash = JSON.stringify({
        mode: mapDisplayMode,
        ids: territoriesDataRef.current.map(t => t.id),
        selectedTerritoryId: selectedTerritoryIdRef.current,
        userId: user?.id || null
      });
      
      // Check cache validity (with 0 center tolerance to immediately redraw on center change)
      if (lastRenderDataRef.current) {
        const { territoriesHash: lastHash, canvasSize, mapZoom, mapCenter } = lastRenderDataRef.current;
        
        if (territoriesHash === lastHash && 
            canvasSize.width === canvasSizeRef.current.width && 
            canvasSize.height === canvasSizeRef.current.height &&
            mapZoom === currentZoom &&
            mapCenter[0] === centerLng &&
            mapCenter[1] === centerLat) {
          return;
        }
      }
      
      renderTerritoriesOnCanvas(
        canvasRef.current!,
        map,
        territoriesDataRef.current,
        canvasSizeRef,
        () => {
          redrawCanvasRef.current?.();
        },
        ownerProfileMapRef.current,
        selectedTerritoryIdRef.current,
        user?.id || null
      );
      
      // Update cache
      lastRenderDataRef.current = {
        territoriesHash,
        canvasSize: { ...canvasSizeRef.current },
        mapZoom: currentZoom,
        mapCenter: [centerLng, centerLat] as [number, number]
      };
    });
  }, [isVisible, map, mapDisplayMode, user?.id]);

  const loadTerritories = useCallback(async () => {
    console.log(`🔮 [loadTerritories] Triggered. Map is ready: ${!!map}, City is ready: ${!!city}, City ID: ${city?.id}`);
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

      lastRenderDataRef.current = null;
      await decorateTerritoriesAsync(rawTerritoriesRef.current);
      customLayerRef.current?.render?.();
      recomputeViewportKing();
      logEvent("territory_render_success", { cityId: city.id, count: territoriesDataRef.current.length });
      requestAnimationFrame(() => {
        if (customLayerRef.current) {
          customLayerRef.current.render?.();
        } else {
          redrawCanvasRef.current();
        }
      });
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
  }, [city, decorateTerritoriesAsync, map, recomputeViewportKing]);

  useEffect(() => {
    loadTerritoriesRef.current = loadTerritories;
    redrawCanvasRef.current = redrawCanvas;
    recomputeViewportKingRef.current = recomputeViewportKing;
  });

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
      redrawCanvasRef.current();
    };

    customLayer.setMap(isVisible ? map : null);
    customLayerRef.current = customLayer;

    return () => {
      // 清理 RAF
      if (redrawRAFRef.current !== null) {
        cancelAnimationFrame(redrawRAFRef.current);
        redrawRAFRef.current = null;
      }
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
  }, [isVisible, map]);

  useEffect(() => {
    if (!map) return;
    const handleRefresh = () => {
      if (isVisibleRef.current) {
        loadTerritoriesRef.current();
      } else {
        pendingRefreshRef.current = true; // 处于后台/隐藏状态时，标记延迟刷新
      }
    };
    window.addEventListener("citylord:refresh-territories", handleRefresh);
    return () => window.removeEventListener("citylord:refresh-territories", handleRefresh);
  }, [map]);

  useEffect(() => {
    if (!isVisible) return;
    
    // Force a redraw when becoming visible to ensure the canvas is up to date immediately
    lastRenderDataRef.current = null;
    loadTerritoriesRef.current();
    if (customLayerRef.current) {
      customLayerRef.current.render?.();
    }
    pendingRefreshRef.current = false;
  }, [isVisible]);

  useEffect(() => {
    if (!map || !isVisible) return;

    const handleMoveStart = () => {
      mapInteractingRef.current = true;
    };

    const handleMoveEnd = () => {
      mapInteractingRef.current = false;
      customLayerRef.current?.render?.();
      recomputeViewportKingRef.current();
    };

    const handleZoomChange = () => {
      redrawCanvasRef.current();
    };

    map.on("movestart", handleMoveStart);
    map.on("zoomstart", handleMoveStart);
    map.on("dragstart", handleMoveStart);
    map.on("moveend", handleMoveEnd);
    map.on("zoomend", handleMoveEnd);
    map.on("zoomchange", handleZoomChange);

    return () => {
      map.off("movestart", handleMoveStart);
      map.off("zoomstart", handleMoveStart);
      map.off("dragstart", handleMoveStart);
      map.off("moveend", handleMoveEnd);
      map.off("zoomend", handleMoveEnd);
      map.off("zoomchange", handleZoomChange);
    };
  }, [map, isVisible]);

  useEffect(() => {
    if (!map || !city?.id || !isVisible) return;

    loadTerritoriesRef.current();

    return () => {
      // Only abort when cityId changes or component unmounts
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      isLoadingRef.current = false;
    };
  }, [map, city?.id, isVisible]);

  useEffect(() => {
    decorateTerritoriesAsync(rawTerritoriesRef.current);
  }, [decorateTerritoriesAsync]);

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

