"use client";

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { safeLoadAMap, safeDestroyMap } from '@/lib/map/safe-amap';
import type { AMapInstance } from '@/components/map/AMapContext';

export interface MapLayerProps {
    initialCenter: [number, number];
    initialZoom: number;
    onMoveEnd?: (center: [number, number]) => void;
    onZoomEnd?: (zoom: number) => void;
    onMapLoad?: () => void;
    onMapReady?: (map: AMapInstance | null) => void;
    mapStyle?: string;
}

export interface MapLayerHandle {
    map: any | null;
    flyTo: (center: [number, number], zoom?: number, duration?: number) => void;
    getCenter: () => [number, number] | null;
}

/**
 * MapLayer: Pure map rendering component
 * 
 * Responsibilities:
 * - Initialize AMap instance
 * - Handle map events (move, zoom)
 * - Emit events to parent
 * - NO GPS logic, NO state management
 */
export const MapLayer = forwardRef<MapLayerHandle, MapLayerProps>(
    ({ initialCenter, initialZoom, onMoveEnd, onZoomEnd, onMapLoad, onMapReady, mapStyle }, ref) => {
        const mapDomRef = useRef<HTMLDivElement>(null);
        const mapRef = useRef<any>(null);

        useImperativeHandle(ref, () => ({
            map: mapRef.current,
            flyTo: (center, zoom = 17, duration = 1000) => {
                if (!mapRef.current) return;
                // AMap 2.0: setZoomAndCenter(zoom, center, immediately, duration)
                mapRef.current.setZoomAndCenter(zoom, center, false, duration);
            },
            getCenter: () => {
                if (!mapRef.current) return null;
                const c = mapRef.current.getCenter();
                return [c.lng, c.lat];
            }
        }));

        useEffect(() => {
            let destroyed = false;
            let moveEndHandler: any = null;
            let zoomEndHandler: any = null;

            (async () => {
                const AMap = await safeLoadAMap({ plugins: ["AMap.Scale", "AMap.MoveAnimation"] });
                if (destroyed || !mapDomRef.current) return;

                if (!AMap) {
                    console.error('[MapLayer] AMap SDK 加载失败，无法初始化地图实例');
                    if (onMapReady) {
                        onMapReady(null);
                    }
                    return;
                }

                // 异步解耦：立即用默认坐标渲染地图，不等待定位结果
                // 使用长沙作为默认坐标，避免北京闪屏
                const safeCenter = initialCenter && initialCenter.length === 2 && 
                                 !isNaN(initialCenter[0]) && !isNaN(initialCenter[1]) ? 
                                 initialCenter : [112.938, 28.228]; // 长沙坐标
                
                const safeZoom = initialZoom && !isNaN(initialZoom) ? initialZoom : 16;

                try {
                    mapRef.current = new AMap.Map(mapDomRef.current, {
                        zoom: safeZoom,
                        center: safeCenter,
                        viewMode: "2D",
                        mapStyle: mapStyle || 'amap://styles/22e069175d1afe32e9542abefde02cb5',
                        showLabel: true,
                        // 优化内存使用：减少瓦片缓存
                        features: ['bg', 'road', 'building', 'point'],
                        // 限制瓦片缓存大小
                        tileLimit: 50,
                        
                        // ✅ Layer 3 优化：限制瓦片缓存数量，防止 tile memory limits exceeded
                        tileSizeCache: 64, // 默认值通常是 256-512，低内存设备建议 64-128
                        
                        // ✅ 降低地图分辨率倍率，减少 GPU 纹理占用
                        // 1 = 标准分辨率; 0.75 = 降低 44% 显存占用，视觉差异几乎不可感知
                        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
                        
                        // ✅ 关闭不必要的3D楼块渲染（3D瓦片比2D消耗多3倍显存）
                        showBuildingBlock: false,
                        
                        // ✅ 调整最大缩放级别，防止过度细化导致瓦片爆炸
                        zooms: [3, 18],  // 默认是 [3, 20]，限制到 18 减少高缩放层级瓦片
                    });

                    // 🟢 新增探头 1：地图刚 new 出来，立刻打印！
                    console.log('🚨 [探头 1 - MapLayer] map created. 实例:', !!mapRef.current, mapRef.current);
                } catch (error) {
                    console.error('[MapLayer] 地图初始化失败:', error);
                    // 即使初始化失败也要通知父组件，避免白屏
                    if (onMapReady) {
                        onMapReady(null);
                    }
                    return;
                }

                // Emit center changes (reverse data flow)
                if (onMoveEnd) {
                    moveEndHandler = () => {
                        if (mapRef.current && !destroyed) {
                            const center = mapRef.current.getCenter();
                            onMoveEnd([center.lng, center.lat]);
                        }
                    };
                    mapRef.current.on('moveend', moveEndHandler);
                }

                if (onZoomEnd) {
                    zoomEndHandler = () => {
                        if (mapRef.current && !destroyed) {
                            onZoomEnd(mapRef.current.getZoom());
                        }
                    };
                    mapRef.current.on('zoomend', zoomEndHandler);
                }

                // Notify parent that map is loaded
                if (onMapLoad && !destroyed) {
                    onMapLoad();
                }

                // Expose map instance to parent — MUST check destroyed flag
                if (onMapReady && !destroyed) {
                    onMapReady(mapRef.current);
                }
            })();

            return () => {
                destroyed = true;
                
                // 清理事件监听器
                if (mapRef.current) {
                    if (moveEndHandler) {
                        mapRef.current.off('moveend', moveEndHandler);
                    }
                    if (zoomEndHandler) {
                        mapRef.current.off('zoomend', zoomEndHandler);
                    }
                    
                    // 强制清理瓦片缓存
                    try {
                        if (mapRef.current.clearCache) {
                            mapRef.current.clearCache();
                        }
                        // 🟡 P1 修复：删除重复的 destroy() 调用，保留 safeDestroyMap() 一次
                        // 原代码：手动调用 destroy() + safeDestroyMap() 导致重复销毁
                        // 修复：只清理缓存，不手动调用 destroy()
                    } catch (error) {
                        console.warn('Map cleanup error:', error);
                    }
                }
                
                safeDestroyMap(mapRef.current);
                mapRef.current = null;
            };
        }, []); // Init once

        return <div ref={mapDomRef} className="w-full h-full" style={{ touchAction: 'none' }} />;
    }
);

MapLayer.displayName = 'MapLayer';
