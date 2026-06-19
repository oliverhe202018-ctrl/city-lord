"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { isNativePlatform, safeCheckGeolocationPermission, safeRequestGeolocationPermission, safeGetCurrentPosition, safeWatchPosition, safeClearWatch, SafePosition,  } from '@/lib/capacitor/safe-plugins';
import gcoord from 'gcoord';
import { useGameStore } from '@/store/useGameStore';

interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

interface GeolocationState {
  loading: boolean;
  error: any | null;
  data: {
    latitude: number;
    longitude: number;
    coordType?: 'gcj02' | 'wgs84';
  } | null;
}

interface UseGeolocationProps {
  options?: GeolocationOptions;
  watch?: boolean;
  disabled?: boolean;
  /**
   * UI 更新的频率限制（毫秒）。
   * 默认 500ms 以平衡视觉平滑度与主线程渲染负荷，防止 Binder Overflow 导致的崩溃。
   */
  uiThrottleMs?: number;
}

/**
 * [Sonnet 4.6 Audit Patch] 
 * 增强型位置钩子：解耦原始轨迹记录与节流化的 UI 渲染。
 * 修复：内存泄漏、闭包陈旧、渲染压力过大。
 */
export const useGeolocation = ({
  options = {},
  watch = false,
  disabled = false,
  uiThrottleMs = 500,
}: UseGeolocationProps = {}) => {
  const [state, setState] = useState<GeolocationState>({
    loading: !disabled,
    error: null,
    data: null,
  });

  const gpsCorrectionEnabled = useGameStore((s) => s.appSettings?.gpsCorrectionEnabled ?? true);
  const setLastKnownLocation = useGameStore((s) => s.setLastKnownLocation);
  const setGpsStatus = useGameStore((s) => s.setGpsStatus);

  const isMounted = useRef(true);
  const watchIdRef = useRef<string | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUiEmitRef = useRef<number>(0);

  /**
   * Last-Mile Ref: 始终持有最新转换后的坐标。
   * 暴露给外部（如 RunService）进行同步读取，确保结算时坐标新鲜度。
   */
  const lastPositionRef = useRef<GeolocationState['data']>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      // 清空所有待执行的延时任务，防止内存泄漏
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (watchIdRef.current) {
        safeClearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  const { enableHighAccuracy, timeout, maximumAge } = options;

  /**
   * 坐标系转换逻辑：WGS-84 -> GCJ-02 (如果开启)
   * 来源校验：原生高德返回的点已标记为 GCJ02，禁止二次转换（防止200-500米固定偏移）
   */
  const transformPosition = useCallback(
    (position: SafePosition): GeolocationState['data'] => {
      let latitude = position.lat;
      let longitude = position.lng;
      let coordType: 'gcj02' | 'wgs84' = 'wgs84';

      // 来源校验：如果已标记为 GCJ02，直接跳过转换
      if ((position as any).coordSystem === 'gcj02') {
        coordType = 'gcj02';
        return { latitude, longitude, coordType };
      }

      if (gpsCorrectionEnabled) {
        const result = gcoord.transform(
          [longitude, latitude],
          gcoord.WGS84,
          gcoord.GCJ02
        );
        longitude = result[0];
        latitude = result[1];
        coordType = 'gcj02';
      }

      return { latitude, longitude, coordType };
    },
    [gpsCorrectionEnabled]
  );

  const getLocation = useCallback(
    async (retryCount = 0) => {
      if (disabled || !isMounted.current) return;

      if (retryCount === 0) {
        setState((prev) => ({ ...prev, loading: true, error: null }));
      }

      try {
        if (await isNativePlatform()) {
          const permissionStatus = await safeCheckGeolocationPermission();
          if (permissionStatus !== 'granted') {
            const requestStatus = await safeRequestGeolocationPermission();
            if (requestStatus !== 'granted') {
              throw new Error('User denied location permission');
            }
          }
        }

        const position = await safeGetCurrentPosition({
          enableHighAccuracy,
          timeout: timeout ?? 10000,
          maximumAge,
        });

        if (!position || !isMounted.current) return;

        const data = transformPosition(position);
        if (data) {
          lastPositionRef.current = data;
          setLastKnownLocation({ lat: data.latitude, lng: data.longitude });
          setGpsStatus('success');
          setState({ loading: false, error: null, data });
        }
      } catch (error: any) {
        console.error(`[useGeolocation] One-shot Error (Retry ${retryCount}):`, error);

        if (!isMounted.current) return;

        if (retryCount < 3) {
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            getLocation(retryCount + 1);
          }, 1000);
          return;
        }

        setState({ loading: false, error, data: null });
        toast.error('获取位置失败', {
          description: error.message || '请检查定位权限',
        });
      }
    },
    [enableHighAccuracy, timeout, maximumAge, disabled, transformPosition, setLastKnownLocation, setGpsStatus]
  );

  // 初始化单次获取
  useEffect(() => {
    if (disabled) {
      setState({ loading: false, error: null, data: null });
      return;
    }
    if (!watch) {
      getLocation();
    }
  }, [getLocation, watch, disabled]);

  // 持续监听逻辑：带节流与锁定的 Watcher
  useEffect(() => {
    if (disabled || !watch) return;

    let isActive = true;

    const startWatching = async () => {
      try {
        // [P1 Fix] 调用 watchPosition 之前，必须强校验 Geolocation.checkPermissions()
        if (await isNativePlatform()) {
          const permissionStatus = await safeCheckGeolocationPermission();
          if (permissionStatus !== 'granted') {
            const requestStatus = await safeRequestGeolocationPermission();
            if (requestStatus !== 'granted') {
              console.warn('[useGeolocation] Watch permission denied');
              setState({ loading: false, error: new Error('Location permission denied'), data: null });
              return;
            }
          }
        }

        const id = await safeWatchPosition(
          (position, err) => {
            if (!isActive || !isMounted.current) return;

            if (err) {
              setState((prev) => ({ ...prev, loading: false, error: err }));
              setGpsStatus('error');
              return;
            }

            if (!position) return;

            // 1. 同步更新核心引用（无阻碍轨迹记录）
            const data = transformPosition(position);
            lastPositionRef.current = data;
            
            // 2. 更新原子化 Store (用于后台服务与轨迹累加)
            if (data) {
                setLastKnownLocation({ lat: data.latitude, lng: data.longitude });
                setGpsStatus('success');
            }

            // 3. UI 节流发射：减轻 WebView 渲染负载
            const now = Date.now();
            if (now - lastUiEmitRef.current >= uiThrottleMs) {
              lastUiEmitRef.current = now;
              setState({ loading: false, error: null, data });
            }
          },
          { enableHighAccuracy, timeout, maximumAge }
        );
        
        if (isActive) {
          watchIdRef.current = id;
        } else {
          safeClearWatch(id);
        }
      } catch (err) {
        console.error('[useGeolocation] Watcher Start Failed:', err);
      }
    };

    startWatching();

    return () => {
      isActive = false;
      if (watchIdRef.current) {
        safeClearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [watch, enableHighAccuracy, timeout, maximumAge, disabled, gpsCorrectionEnabled, uiThrottleMs, transformPosition, setLastKnownLocation, setGpsStatus]);

  const refetch = useCallback(() => {
    if (!disabled) getLocation();
  }, [disabled, getLocation]);

  return { ...state, refetch, lastPositionRef };
};
