"use client"

import { useEffect, useRef, useState, useCallback } from 'react';
import { safeLoadAMap, safeDestroyMap, type SafeAMapLoadOptions } from '@/lib/map/safe-amap';

interface UseAMapOptions {
  /** 地图容器的 ref 不由 hook 管理时，传入外部 ref */
  containerRef?: React.RefObject<HTMLDivElement>;
  /** AMap.Map 构造参数 */
  mapOptions?: Record<string, any>;
  /** safeLoadAMap 参数 */
  loadOptions?: SafeAMapLoadOptions;
  /** 地图创建成功回调 */
  onMapReady?: (map: any, AMap: any) => void;
  /** 地图加载失败回调 */
  onError?: (error: string) => void;
}

export function useAMap(options: UseAMapOptions = {}) {
  const internalRef = useRef<HTMLDivElement>(null);
  const containerRef = options.containerRef ?? internalRef;
  const mapRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let destroyed = false;

    (async () => {
      try {
        const AMap = await safeLoadAMap(options.loadOptions);
        if (destroyed || !containerRef.current) return;

        if (!AMap) {
          const msg = '高德地图 SDK 加载失败';
          setError(msg);
          options.onError?.(msg);
          return;
        }

        const map = new AMap.Map(containerRef.current, {
          zoom: 13,
          center: [116.397428, 39.90923],
          viewMode: '2D',
          mapStyle: 'amap://styles/22e069175d1afe32e9542abefde02cb5',
          showLabel: true,
          ...options.mapOptions,
        });

        if (destroyed) {
          map.destroy();
          return;
        }

        mapRef.current = map;
        setIsReady(true);
        options.onMapReady?.(map, AMap);
      } catch (err: any) {
        if (!destroyed) {
          const msg = err?.message || '地图初始化失败';
          setError(msg);
          options.onError?.(msg);
        }
      }
    })();

    return () => {
      destroyed = true;
      safeDestroyMap(mapRef.current);
      mapRef.current = null;
      setIsReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoomIn = useCallback(() => mapRef.current?.zoomIn(), []);
  const zoomOut = useCallback(() => mapRef.current?.zoomOut(), []);
  const panTo = useCallback((lnglat: [number, number]) => mapRef.current?.panTo(lnglat), []);
  const setZoom = useCallback((zoom: number) => mapRef.current?.setZoom(zoom), []);

  return {
    containerRef: internalRef,
    map: mapRef.current,
    isReady,
    error,
    zoomIn,
    zoomOut,
    panTo,
    setZoom,
  };
}
