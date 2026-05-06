"use client";

import React, { useState, useEffect, ReactNode, useCallback, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { MapProvider, LocationState, AMapInstance } from './AMapContext';
import { MapInteractionProvider } from './MapInteractionContext';
import { useTheme } from '@/components/citylord/theme/theme-provider';
import type { GeoPoint } from '@/hooks/useSafeGeolocation';
import { useLocationStore } from '@/store/useLocationStore';
import { useLocationContext } from '@/components/GlobalLocationProvider';
import { useGameStore } from '@/store/useGameStore';
import type { ExtTerritory } from '@/types/city';

const MAP_STYLES: Record<string, string> = {
  cyberpunk: 'amap://styles/22e069175d1afe32e9542abefde02cb5',
  light: 'amap://styles/normal',
  nature: 'amap://styles/fresh',
};

/**
 * MapRoot: Central state management for running game
 * 
 * State Model:
 * - userPosition: Current GPS location
 * - userPath: GPS trajectory history (SOURCE OF TRUTH for territory)
 * - mapCenter: Map viewport center
 * - isTracking: Auto-follow mode
 * 
 * Responsibilities:
 * - Manage all map-related state
 * - Integrate with useSafeGeolocation
 * - Provide state to children via context
 * - NO map rendering (delegated to MapLayer)
 */
export function MapRoot({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<AMapInstance | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [viewMode, setViewMode] = useState<'individual' | 'faction'>('individual');
  const { themeId } = useTheme();

  // 🟢 新增探头 2：只要 map 状态发生改变，立刻打印！
  useEffect(() => {
    console.log('🚨 [探头 2 - MapRoot] map 状态更新为:', map);
  }, [map]);

  // Running Game State Model
  const DEFAULT_CENTER: [number, number] = [116.397428, 39.90923];

  const [userPosition, setUserPosition] = useState<GeoPoint | null>(null);
  const [userPath, setUserPath] = useState<GeoPoint[]>([]); // GPS trajectory (source of truth)
  const userPathLengthRef = useRef(0); // 跟踪路径长度变化，用于稀疏化触发
  
  // 路径简化函数：过滤掉距离过近的点，控制数组体积
  const simplifyPath = useCallback((path: GeoPoint[], thresholdMeters = 3): GeoPoint[] => {
    if (path.length <= 1) return path;
    
    const simplified = [path[0]];
    for (let i = 1; i < path.length; i++) {
      const lastPoint = simplified[simplified.length - 1];
      
      // 计算两点间距离（米）
      const distance = Math.sqrt(
        Math.pow((path[i].lat - lastPoint.lat) * 111000, 2) +
        Math.pow((path[i].lng - lastPoint.lng) * 111000 * Math.cos(path[i].lat * Math.PI / 180), 2)
      );
      
      // 只有当距离超过阈值时才保留该点
      if (distance >= thresholdMeters) {
        simplified.push(path[i]);
      }
    }
    return simplified;
  }, []);

  // Synchronous cache read for instant map center (avoids Beijing flash)
  // Wrapped in typeof window check to prevent Next.js hydration mismatch
  const [mapCenter, setMapCenter] = useState<[number, number]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('last_known_location');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.lat && parsed?.lng &&
            typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
            return [parsed.lng, parsed.lat] as [number, number];
          }
        }
      } catch {
        // Silently fall back to default on parse error
      }
    }
    return DEFAULT_CENTER;
  });

  const [isTracking, setIsTracking] = useState<boolean>(true); // Auto-follow initially
  const isTrackingRef = useRef(isTracking);
  useEffect(() => {
    isTrackingRef.current = isTracking;
  }, [isTracking]);

  const [showKingdom, setShowKingdom] = useState<boolean>(true); // Kingdom layer visible by default
  const [kingdomMode, setKingdomMode] = useState<'personal' | 'club'>('personal');
  const [showFog, setShowFog] = useState<boolean>(false); // Fog layer off by default
  const showFactionColors = useGameStore(s => s.showFaction);
  const setShowFactionColors = useGameStore(s => s.setShowFaction);
  const [selectedTerritory, setSelectedTerritory] = useState<ExtTerritory | null>(null);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState<boolean>(false);

  const toggleKingdom = useCallback(() => {
    setShowKingdom(prev => !prev);
  }, []);

  const toggleFog = useCallback(() => {
    setShowFog(prev => !prev);
  }, []);

  const toggleFactionColors = useCallback(() => {
    setShowFactionColors(!showFactionColors);
  }, [showFactionColors, setShowFactionColors]);

  const mapLayerRef = useRef<any>(null);
  const positionStage = useRef<'cache' | 'network-coarse' | 'gps-precise' | null>(null);
  const initRendered = useRef<boolean>(false); // C.3: Stage initialization deduplication (prevent double fly)
  const hasDoneFirstFlyRef = useRef<boolean>(false);
  const lastFlyTime = useRef<number>(0);
  const flyReason = useRef<string>('none');

  // C.1: Pending cannot just be the fix. Store the entire parameter set.
  const pendingFlyRef = useRef<{
    fix: GeoPoint,
    duration: number,
    zoom: number, // not strictly used yet but reserved for semantic completeness
    reason: string,
    ts: number
  } | null>(null);

  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoRecoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const userInteracted = useRef(false); // Track manual map drag to prevent auto-jump

  // B.1: Cleanup throttle timer on unmount
  useEffect(() => {
    return () => {
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
      if (autoRecoverTimerRef.current) {
        clearTimeout(autoRecoverTimerRef.current);
      }
    };
  }, []);

  // Read GPS state from global singleton store (written by GlobalLocationProvider)
  const location = useLocationStore(s => s.location ?? null);
  const loading = useLocationStore(s => s.loading ?? true);
  const error = useLocationStore(s => s.error ?? null);
  // ✅ 关键修复：强制 fallback 为合法联合类型值，绝不允许 undefined
  const gpsSignalStrength = useLocationStore(s => (s.gpsSignalStrength ?? 'none') as 'none' | 'weak' | 'good');
  const status = useLocationStore(s => s.status ?? 'initializing');
  
  // Fix: Ensure gpsSignalStrength is properly defined and available in scope

  // Non-serializable callbacks from Context
  const { retry, getDebugData } = useLocationContext();

  // Debug states (C.7)
  const userPositionRef = useRef<GeoPoint | null>(null);
  useEffect(() => {
    userPositionRef.current = userPosition;
  }, [userPosition]);

  const [debugInfo, setDebugInfo] = useState<any>(null);
  const getDebugDataRef = useRef<(() => any) | null>(null);
  const statusRef = useRef(status);
  const gpsSignalStrengthRef = useRef(gpsSignalStrength);
  useEffect(() => { getDebugDataRef.current = getDebugData; }, [getDebugData]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { 
    // ✅ 写入 ref 前也要保证非 undefined
    gpsSignalStrengthRef.current = gpsSignalStrength ?? 'none'; 
  }, [gpsSignalStrength]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    // 仅在严格 dev 环境开启，删除 debug=1 生产后门
    if (process.env.NODE_ENV === 'development') {
      interval = setInterval(() => {
        const hookDebug = getDebugDataRef.current?.() || {};
        setDebugInfo({
          source: userPositionRef.current?.source || 'none',
          accuracy: userPositionRef.current?.accuracy || 'N/A',
          isTracking: isTrackingRef.current,
          userInteracted: userInteracted.current,
          hasTimer: throttleTimerRef.current !== null,
          pendingReason: pendingFlyRef.current?.reason || 'none',
          lastFlyReason: flyReason.current,
          watchIdExists: hookDebug.watchIdExists,
          restartInFlight: hookDebug.restartInFlight,
          gpsSignalStrength: gpsSignalStrengthRef.current,
          status: statusRef.current
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  // --- GPS Status → Game Store Sync ---
  const setGpsStatus = useGameStore(state => state.setGpsStatus);
  const updateStoreLocation = useGameStore(state => state.updateLocation);
  const resetRunState = useGameStore(state => state.resetRunState);
  const isRunning = useGameStore(state => state.isRunning);

  // isRunning ref for stable callback references (声明在 isRunning 之后)
  const isRunningRef = useRef(isRunning);
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  // Bug5: On mount, if not actively running, clear persisted run path to prevent ghost lines
  useEffect(() => {
    if (!isRunning) {
      resetRunState();
    }
    // Also reset stage for fresh login
    positionStage.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync useSafeGeolocation status → game store gpsStatus
  useEffect(() => {
    const statusMap: Record<string, 'locating' | 'success' | 'error' | 'weak'> = {
      locked: 'success',
      locating: 'locating',
      error: 'error',
      initializing: 'locating',
    };
    const mappedStatus = statusMap[status] || 'locating';
    setGpsStatus(mappedStatus);

    // Bug5: Dismiss lingering GPS weak-signal toasts when GPS locks
    if (status === 'locked') {
      toast.dismiss();
    }
  }, [status, setGpsStatus]);

  // Sync GPS coordinates → game store so MapHeader's reverse geocoding triggers
  useEffect(() => {
    if (location?.lat && location?.lng && location.lat !== 0 && location.lng !== 0) {
      updateStoreLocation(location.lat, location.lng);
    }
  }, [location, updateStoreLocation]);

  // Init userPosition from cache (Client-side only)
  // Note: mapCenter is already initialized synchronously in useState above.
  useEffect(() => {
    try {
      const cached = localStorage.getItem('last_known_location');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.lat && parsed?.lng &&
          typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          // Only set if we don't have a real GPS lock yet
          setUserPosition(prev => prev ? prev : { ...parsed, source: 'cache' as const });
        }
      }
    } catch {
      // Silently ignore cache errors
    }
  }, []);

  // Setup Map Interaction Listeners for dragstart/touchstart to disable tracking
  useEffect(() => {
    if (!map) return;
    
    // 使用 useCallback 包装处理函数，避免依赖循环
    const handleInteraction = () => {
      if (isTrackingRef.current) {
        setIsTracking(false);
      }
      userInteracted.current = true;
      // B.2: Clear pending flyTo timer immediately when user interacts
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      pendingFlyRef.current = null;
    };

    // Bind to map events
    map.on('dragstart', handleInteraction);
    map.on('touchstart', handleInteraction);

    return () => {
      map.off('dragstart', handleInteraction);
      map.off('touchstart', handleInteraction);
    };
  }, [map]); // 移除 isTracking 和 setIsTracking 依赖，使用 ref

  // [P2] 锁屏苏醒时 AMap Context 容错自检防崩补丁
  useEffect(() => {
    const handleContextCheck = () => {
      if (map) {
        try {
          map.getCenter();
        } catch (err) {
          // 🟢 新增探头 4：把被谁杀死的，什么原因，打印出来！
          console.error('🚨 [探头 4 - 致命错误] Context lost! 准备强杀 map 实例重置。报错原因:', err);
          console.error("[MapRoot] AMap WebGL Context lost detected on resume. Reinitializing MapLayer.", err);
          // ✅ 新增：重置首次飞行标志，保证重建后视角恢复
          hasDoneFirstFlyRef.current = false;
          positionStage.current = null;       // ✅ 新增：重置 Stage，触发完整初始化流程
          initRendered.current = false;       // ✅ 新增：允许 cache-init 重新执行
          setMap(null); // 强制释放无效的 map 实例，引发 MapLayer 卸载并重新触发加载逻辑
        }
      }
    };
    window.addEventListener('amap-context-check', handleContextCheck);
    return () => {
      window.removeEventListener('amap-context-check', handleContextCheck);
    };
  }, [map]);

  // Sync Map Style
  useEffect(() => {
    if (map && map.setMapStyle) {
      map.setMapStyle(MAP_STYLES[themeId] || 'amap://styles/normal');
    }
  }, [map, themeId]);

  // Update user position (always) and trajectory (only when running)
  useEffect(() => {
    if (location && location.lat !== 0 && location.lng !== 0) {
      setUserPosition(location);

      // ❌ 删除重复的异步移动代码，统一由 Stage-based FlyTo 逻辑控制
      // 避免双重 setCenter 调用导致的抖动和额外 GL 渲染压力

      // CRITICAL: Only accumulate trajectory when actively running
      // This prevents ghost polylines on cold start / initial GPS lock
      if (isRunningRef.current) { // 用 ref，无需 isRunning 在依赖数组
        setUserPath(prev => {
          // Prevent duplicate points (within 1m)
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            const dist = Math.sqrt(
              Math.pow((location.lat - last.lat) * 111000, 2) +
              Math.pow((location.lng - last.lng) * 111000 * Math.cos(location.lat * Math.PI / 180), 2)
            );
            if (dist < 1) return prev; // Skip if too close
          }
          
          // 优化：使用 push 替代展开操作符，减少 GC 压力
          const newPath = prev.slice(); // 浅拷贝
          newPath.push(location);
          
          // 性能优化：路径稀疏化控制
          // 当路径长度每增加50个点时，触发一次简化
          if (newPath.length - userPathLengthRef.current >= 50) {
            const simplified = simplifyPath(newPath, 3); // 3米阈值
            userPathLengthRef.current = simplified.length;
            return simplified;
          }
          
          return newPath;
        });
      }
    }
  }, [location, simplifyPath]); // 移除 isRunning 和 map（map 不影响此逻辑）

  // Clear trajectory when run stops
  useEffect(() => {
    if (!isRunning) {
      setUserPath([]);
      userPathLengthRef.current = 0; // 重置路径长度计数器
    }
  }, [isRunning]);

  // Stage-based Locating and FlyTo Animation Control
  useEffect(() => {
    if (!userPosition) return;
    // 优先从 mapLayerRef 获取实例，避免将 map state 加入依赖
    const mapInstance = mapLayerRef.current?.map;
    if (!mapInstance) return; // 无实例时直接 return，不触发任何 fly 逻辑

    // 使用 ref 获取最新状态，避免依赖循环
    const currentIsTracking = isTrackingRef.current;
    const currentUserInteracted = userInteracted.current;

    const source = userPosition.source || 'cache';
    // [FIX] 将新架构的 source 归一到旧 Stage 系统
    const normalizedSource =
        source === 'amap-native' || source === 'web-fallback'
            ? 'gps-precise'
            : source === 'amap-native-cache'
                ? 'network-coarse'
                : source;

    const accuracy = userPosition.accuracy || 9999;
    const now = Date.now();

    // Helper to get precise distance
    const getDistance = () => {
      try {
        const currentCenter = mapInstance.getCenter();
        if (!currentCenter) return Infinity;
        const AMap = (window as { AMap?: { GeometryUtil?: { distance: (a: [number, number], b: [number, number]) => number } } }).AMap;
        if (AMap?.GeometryUtil?.distance) {
          return AMap.GeometryUtil.distance(
            [userPosition.lng, userPosition.lat],
            [currentCenter.lng, currentCenter.lat]
          );
        } else {
          // Fallback approximation
          return Math.sqrt(
            Math.pow((userPosition.lat - currentCenter.lat) * 111000, 2) +
            Math.pow((userPosition.lng - currentCenter.lng) * 111000 * Math.cos(userPosition.lat * Math.PI / 180), 2)
          );
        }
      } catch {
        return Infinity;
      }
    };

    const executeFly = (lng: number, lat: number, duration: number, reason: string) => {
      try {
        if (mapLayerRef.current?.flyTo) {
          mapLayerRef.current.flyTo([lng, lat], 17, duration);
        } else if (mapInstance.setZoomAndCenter) {
          mapInstance.setZoomAndCenter(17, [lng, lat], false, duration);
        } else {
          mapInstance.setCenter([lng, lat]);
        }
        lastFlyTime.current = Date.now();
        flyReason.current = reason;
      } catch { /* silently handle map errors */ }
    };

    const doFlyTo = (duration: number, force: boolean = false, reason: string = 'auto') => {
      // Ignore if user is manually browsing and we're not forcing
      if (!force && (!currentIsTracking || currentUserInteracted)) {
        // B.2: isTracking=false: only update marker/trajectory, don't trigger or queue FlyTo.
        return;
      }

      const timeSinceLastFly = now - lastFlyTime.current;
      if (timeSinceLastFly < 1000) {
        // C.1: Trailing throttle updates the ENTIRE payload (uses latest condition)
        pendingFlyRef.current = {
          fix: userPosition,
          duration,
          zoom: 17,
          reason,
          ts: Date.now()
        };
        if (!throttleTimerRef.current) {
          throttleTimerRef.current = setTimeout(() => {
            throttleTimerRef.current = null;
            if (pendingFlyRef.current) {
              // Ensure we only fly if tracking or forced later
              if (currentIsTracking || force) {
                const p = pendingFlyRef.current;
                executeFly(p.fix.lng, p.fix.lat, p.duration, p.reason);
              }
              pendingFlyRef.current = null;
            }
          }, 1000 - timeSinceLastFly);
        }
        return;
      }

      executeFly(userPosition.lng, userPosition.lat, duration, reason);
    };

    // Stage Upgrade & Action Logic
    if (normalizedSource === 'cache') {
      if (positionStage.current === null) {
        positionStage.current = 'cache';
        // C.3: Guarantee initialization executes only once
        if (!initRendered.current) {
          initRendered.current = true;
          try { mapInstance.setCenter([userPosition.lng, userPosition.lat]); flyReason.current = 'cache-init'; } catch { }
        }
      }
    }
    else if (normalizedSource === 'network-coarse') {
      if (positionStage.current !== 'gps-precise') {
        positionStage.current = 'network-coarse';
        const dist = getDistance();
        // C.2: Explicit gate and comment for network-coarse isTracking=false
        // Do not fly unless tracking is on AND the user is far away enough.
        if (dist > 30) {
          if (currentIsTracking) {
            doFlyTo(500, false, 'network-correction');
          } else {
            console.debug('[MapRoot] Skipped network-coarse flyTo because isTracking is false');
            // Marker updates implicitly because userPosition state was set
          }
        }
      }
    }
    else if (normalizedSource === 'gps-precise') {
      positionStage.current = 'gps-precise';
      const dist = getDistance();

      // [P0+] first-fix 无条件起动飞跃与弱信号兜底降级处理
      if (!hasDoneFirstFlyRef.current) {
        hasDoneFirstFlyRef.current = true;
        if (accuracy > 200) {
          executeFly(userPosition.lng, userPosition.lat, 1000, 'first-gps-fix-weak');
          try { mapInstance.setZoom(14); } catch {} // 使用偏弱 14 级宏观比例
        } else {
          doFlyTo(1000, true, 'first-gps-fix');
        }
        return;
      }

      // Dual Threshold FlyTo Rule + Accuracy Fallback
      if (Number.isNaN(accuracy) || accuracy === undefined || accuracy === null || accuracy === 9999) {
        // Fallback rule for unknown accuracy: only jump if VERY far
        if (dist > 200) {
          if (currentIsTracking) {
            doFlyTo(1000, false, 'gps-fallback-correction');
          }
        }
      } else if (dist > 150 && accuracy <= 200) {
        // Force correction (high priority)
        if (currentIsTracking) {
          doFlyTo(1000, false, 'gps-high-priority-correction');
        }
      } else if (dist > 50 && accuracy <= 80) {
        // Normal correction (only if tracking)
        if (currentIsTracking) {
          doFlyTo(1000, false, 'gps-normal-correction');
        }
      }
    }
  }, [userPosition]); // ✅ 移除 map 依赖，仅在 userPosition 变化时触发

  // GPS Timeout: silently use cached position if no fix within 15s
  // Non-critical status messages are suppressed per UX policy.
  // Only hard permission errors (GPS denied, notification denied, background denied) should show toasts.

  // Map move handler (reverse data flow) - 使用 ref 消除高频依赖
  const handleMapMoveEnd = useCallback((center: [number, number]) => {
    setMapCenter(center);
    // User manual drag disables tracking (but only if it's a significant move)
    const pos = userPositionRef.current;
    const tracking = isTrackingRef.current;
    const running = isRunningRef.current;
    
    if (pos) {
      if (tracking) {
        const dist = Math.sqrt(
          Math.pow((center[1] - pos.lat) * 111000, 2) +
          Math.pow((center[0] - pos.lng) * 111000 * Math.cos(pos.lat * Math.PI / 180), 2)
        );
        // Disable tracking if user dragged more than 20m away
        if (dist > 20) {
          setIsTracking(false);
          userInteracted.current = true; // Prevent auto-jump after manual drag
        }
      } else {
        userInteracted.current = true;
      }

      // [P2] 跑步态 5s 自动恢复跟踪逻辑
      if (running) {
        if (autoRecoverTimerRef.current) clearTimeout(autoRecoverTimerRef.current);
        autoRecoverTimerRef.current = setTimeout(() => {
          userInteracted.current = false;
          setIsTracking(true);
          autoRecoverTimerRef.current = null;
        }, 5000);
      }
    }
  }, []); // 依赖数组为空，函数引用永远稳定

  // Center map with flyTo (Locate Me) - 使用 ref 消除 userPosition 依赖
  const centerMap = useCallback(() => {
    const pos = userPositionRef.current; // 从 ref 读取，无需依赖
    if (pos) {
      // B.4: Cancel any pendingFix/timer BEFORE setIsTracking(true)
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      pendingFlyRef.current = null;

      // Force return to center, enable tracking, bypass all thresholds
      userInteracted.current = false;
      setIsTracking(true);

      try {
        const mapInst = mapLayerRef.current?.map || map; // map 通过 ref 也可解耦，但此处接受
        if (mapLayerRef.current?.flyTo) {
          mapLayerRef.current.flyTo([pos.lng, pos.lat], 17, 1000);
        } else if (mapInst?.setZoomAndCenter) {
          mapInst.setZoomAndCenter(17, [pos.lng, pos.lat], false, 1000);
        } else if (mapInst) {
          mapInst.setCenter([pos.lng, pos.lat]);
        }
        lastFlyTime.current = Date.now();
      } catch {
        // Silently handle map operation errors
      }
    } else {
      toast.error("暂未获取到定位");
      retry();
    }
  }, [retry, map]); // 移除 userPosition 依赖

  // 向下兼容的 locationState - 移除 coords 字段以切断依赖链
  const locationState: LocationState = useMemo(() => ({
    status: loading ? 'loading' : (error ? 'error' : 'success'),
    message: error || undefined,
    // ❌ 移除 coords 字段：消费者应直接使用 useLocationStore() 获取实时位置
    // coords 字段仅在有消费者时保留，否则删除以切断依赖链
  }), [loading, error]); // 移除 userPosition 依赖

  const initLocation = useCallback(async () => {
    retry();
  }, [retry]);

  const setSelectedTerritoryId = useGameStore((state) => state.setSelectedTerritoryId);

  const openTerritoryDetailDrawer = useCallback((id: string) => {
    setSelectedTerritoryId(id);
    setIsDetailSheetOpen(true);
  }, [setSelectedTerritoryId]);


  // Initial AMap check
  useEffect(() => {
    const MAX_ATTEMPTS = 50; // 最大尝试次数：50次 * 100ms = 5秒超时
    let attemptCount = 0;
    let timerId: NodeJS.Timeout | null = null;
    
    const checkAMap = () => {
      attemptCount++;
      
      // 检查超时条件
      if (attemptCount >= MAX_ATTEMPTS) {
        console.warn('[MapRoot] AMap loading timeout after 5 seconds');
        return;
      }
      
      if (typeof window !== 'undefined' && (window as any).AMap) {
        setIsLoaded(true);
        return;
      }
      
      // 继续轮询
      timerId = setTimeout(checkAMap, 100);
    };
    
    checkAMap();
    
    return () => {
      // 清理定时器，防止内存泄漏
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
    };
  }, []);

  // WebGL 资源异步释放：组件卸载时销毁高德地图实例
  const mapDestroyRef = useRef<AMapInstance | null>(null);
  useEffect(() => {
    if (map) {
      mapDestroyRef.current = map;
    }
  }, [map]);

  useEffect(() => {
    return () => {
      const mapToDestroy = mapDestroyRef.current;
      if (mapToDestroy) {
        setTimeout(() => {
          try {
            (mapToDestroy as AMapInstance & { clearEvents?: () => void; destroy?: () => void }).clearEvents?.();
            (mapToDestroy as AMapInstance & { destroy?: () => void }).destroy?.();
          } catch (e) {
            console.warn('[MapRoot] map.destroy() failed:', e);
          }
        }, 0);
      }
    };
  }, []); // 空依赖：仅卸载时执行一次

    const interactionValue = useMemo(() => ({
      selectedTerritory,
      setSelectedTerritory,
      isDetailSheetOpen,
      setIsDetailSheetOpen,
      viewMode,
      setViewMode,
      kingdomMode,
      setKingdomMode,
      showKingdom,
      toggleKingdom,
      showFog,
      toggleFog,
      showFactionColors,
      toggleFactionColors,
      openTerritoryDetailDrawer,
    }), [
      selectedTerritory, isDetailSheetOpen, viewMode, kingdomMode,
      showKingdom, toggleKingdom, showFog, toggleFog, showFactionColors, toggleFactionColors, openTerritoryDetailDrawer
    ]);

    // 低频状态 Context（临时恢复高频定位字段以修复白屏问题）
    const contextValue = useMemo(() => ({
      map,
      setMap,
      isLoaded,
      viewMode,
      setViewMode,
      locationState,
      initLocation,
      centerMap,
      mapLayerRef,
      handleMapMoveEnd,
      // ✅ 临时恢复高频字段以修复 AMapView.tsx 白屏问题
      currentLocation: userPosition,
      userPath,
      mapCenter,
      isTracking,
      setIsTracking,
      // ✅ 双重防御：确保写入 Context 的值永远是合法字符串
      gpsSignalStrength: (gpsSignalStrength ?? 'none') as 'none' | 'weak' | 'good',
      locationStatus: status ?? 'initializing',
      // 以下字段已迁移到 useMapInteraction()，不再保留在 contextValue 中
      // showKingdom, toggleKingdom, kingdomMode, setKingdomMode,
      // showFog, toggleFog, showFactionColors, toggleFactionColors,
      // selectedTerritory, setSelectedTerritory,
    }), [
      map, isLoaded, viewMode, locationState,
      initLocation, centerMap,
      handleMapMoveEnd,
      userPosition, userPath, mapCenter, isTracking, setIsTracking, status, gpsSignalStrength,
      // 已移除重复的UI控制状态依赖
    ]);

    return (
      <MapProvider value={contextValue}>
        <MapInteractionProvider value={interactionValue}>
        {children}
        {debugInfo && (
          <div style={{
            position: 'absolute', top: 50, left: 10, zIndex: 9999, background: 'rgba(0,0,0,0.7)',
            color: 'lime', fontSize: '10px', padding: '8px', pointerEvents: 'none', borderRadius: '4px',
            fontFamily: 'monospace', whiteSpace: 'pre', lineHeight: '1.2'
          }}>
            <div>src: {debugInfo.source} | acc: {debugInfo.accuracy}</div>
            <div>track: {String(debugInfo.isTracking)} | drag: {String(debugInfo.userInteracted)}</div>
            <div>timer: {String(debugInfo.hasTimer)}</div>
            <div>pend: {debugInfo.pendingReason} | fly: {debugInfo.lastFlyReason}</div>
            <div>watch: {String(debugInfo.watchIdExists)} | lock: {String(debugInfo.restartInFlight)}</div>
            <div>sig: {debugInfo.gpsSignalStrength} | status: {debugInfo.status}</div>
          </div>
        )}
        </MapInteractionProvider>
      </MapProvider>
    );
  }
