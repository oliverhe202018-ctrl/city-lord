"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAMap } from "@/components/map/AMapProvider";
import { PlannerTutorial } from "@/components/citylord/map/PlannerTutorial"; 
import SaveRouteModal from "@/components/citylord/map/SaveRouteModal";
import { SaveSuccessDialog } from "@/components/citylord/map/SaveSuccessDialog";
import { MyRoutesSheet, Route } from "@/components/citylord/map/MyRoutesSheet";
import { Button } from "@/components/ui/button";
import { 
  Undo, 
  Redo, 
  Pen, 
  Save, 
  MapPin, 
  X, 
  Zap, 
  Hexagon,
  RotateCcw,
  HelpCircle,
  List,
  Trash2
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useGameStore } from "@/store/useGameStore";
import { calculateSmartRoute } from "@/lib/utils/routing";
import { latLngToCell } from "h3-js";
import AMapLoader from "@amap/amap-jsapi-loader";
import { Capacitor } from "@capacitor/core";

// Security Config
const AMAP_KEY = process.env.NEXT_PUBLIC_AMAP_KEY || "2f65c697074e0d4c8270195561578e06";

interface RoutePoint {
  lat: number;
  lng: number;
  isKey?: boolean; // Whether this point is a key node (draggable marker)
}

interface PlannerState {
  waypoints: RoutePoint[];
}

export default function PlannerClientView() {
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const amapRef = useRef<any>(null); // To store AMap object
  const polylineRef = useRef<any>(null);
  const polygonRef = useRef<any>(null); // For loop closure
  const closurePolylineRef = useRef<any>(null); // For dashed closing line
  const markersRef = useRef<any[]>([]);

  // Hand-drawing Refs
  const isDrawingRef = useRef(false);
  const currentDrawPathRef = useRef<RoutePoint[]>([]);
  const tempPolylineRef = useRef<any>(null);
  const isCalculatingRef = useRef(false); // Ref for immediate access in handlers
  const snapToRoadRef = useRef(false); // Ref for snap toggle
  // const drawnPolylinesRef = useRef<any[]>([]); // DEPRECATED: Unified state used instead
  
  const userLat = useGameStore((state) => state.latitude);
  const userLng = useGameStore((state) => state.longitude);

  // --- State ---
  const [drawMode, setDrawMode] = useState<'point' | 'draw'>('point');
  const [snapToRoad, setSnapToRoad] = useState(false);
  const [isLoopClosed, setIsLoopClosed] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  
  // Unified Path State: Contains all points (both clicked and freehand-generated)
  const [points, setPoints] = useState<RoutePoint[]>([]); 
  const [snappedPath, setSnappedPath] = useState<RoutePoint[]>([]); // Snapped path result
  // const [drawnPaths, setDrawnPaths] = useState<RoutePoint[][]>([]); // DEPRECATED
  const [isDragging, setIsDragging] = useState(false);
  const [dragPointIndex, setDragPointIndex] = useState<number | null>(null);

  // Refs for map elements
  const rawPolylineRef = useRef<any>(null); // Dashed line for raw path
  const snappedPolylineRef = useRef<any>(null); // Solid line for snapped path

  // Tutorial State
  const [showTutorial, setShowTutorial] = useState(false);
  const showTutorialRef = useRef(false);

  useEffect(() => {
    showTutorialRef.current = showTutorial;
  }, [showTutorial]);

  // Computed Metrics
  const [distance, setDistance] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [area, setArea] = useState(0); // Estimated capture area

  // Save/Manage Workflow State
  const [showSaveDrawer, setShowSaveDrawer] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showMyRoutes, setShowMyRoutes] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [previewPath, setPreviewPath] = useState<string>("");

  const currentPath = points.length > 0 ? points : [];

  // --- Map Initialization ---
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Capacitor Touch Handling for Android
    if (Capacitor.isNativePlatform()) {
      const container = mapContainerRef.current;
      const handleTouch = (e: TouchEvent) => {
        e.stopPropagation();
      };
      container.addEventListener('touchstart', handleTouch, { passive: false });
      return () => {
        container.removeEventListener('touchstart', handleTouch);
      };
    }
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (typeof window !== "undefined") {
      (window as any)._AMapSecurityConfig = {
        securityJsCode: 'e827ba611fad4802c48dd900d01eb4bf',
      }
    } else {
        return; // Don't run on server
    }

    AMapLoader.load({
      key: AMAP_KEY,
      version: "2.0",
      plugins: ["AMap.Scale", "AMap.ToolBar", "AMap.Walking", "AMap.GeometryUtil", "AMap.Geolocation", "AMap.Polyline", "AMap.Marker", "AMap.Polygon"],
    }).then((AMap) => {
      if (!mapContainerRef.current) return; // Guard: Component might have unmounted

      const map = new AMap.Map(mapContainerRef.current, {
        viewMode: "2D",
        zoom: 17,
        center: [userLng || 116.397, userLat || 39.909],
        mapStyle: "amap://styles/dark",
        skyColor: '#1f2029'
      });

      mapInstanceRef.current = map;
      amapRef.current = AMap; // Store AMap instance

      map.plugin('AMap.Geolocation', () => {
        const geolocation = new AMap.Geolocation({
          enableHighAccuracy: true,
          timeout: 10000,
          convert: true,
          showButton: false, // Hide default button, we use custom UI
          showMarker: true,  // Show self location marker
          showCircle: true,  // Show accuracy circle
          zoomToAccuracy: false, // Don't auto-zoom
        });
        map.addControl(geolocation);
        geolocation.getCurrentPosition((status: string, result: any) => {
          if (status === 'complete' && result?.position) {
            map.setCenter([result.position.lng, result.position.lat]);
            map.setZoom(17);
          }
        });
      });

      // Click Handler for Waypoint Mode
      map.on('click', handleMapClick);
      
      const container = mapContainerRef.current;
      if (container) {
        // Touch Events
        container.addEventListener('touchstart', handleDrawStart, { passive: false });
        container.addEventListener('touchmove', handleDrawMove, { passive: false });
        container.addEventListener('touchend', handleDrawEnd, { passive: false });
        
        // Mouse Events
        container.addEventListener('mousedown', handleDrawStart);
        container.addEventListener('mousemove', handleDrawMove);
        container.addEventListener('mouseup', handleDrawEnd);
        
        // Capacitor Touch Protection
        if (Capacitor.isNativePlatform()) {
          container.addEventListener('touchstart', (e) => {
            if (modeRef.current === 'draw') {
              e.stopPropagation();
            }
          }, { passive: false });
        }
      }
      
      // Mark map as ready
      setIsMapReady(true);
      console.log('✅ Map initialized successfully');
      
    }).catch(e => {
        console.error('Failed to load AMap:', e);
        setIsMapReady(true); // Stop loading spinner
        toast({ title: "地图加载失败", description: "请检查网络连接或刷新重试", variant: "destructive" });
    });

    return () => {
      // Cleanup DOM Listeners
      const container = mapContainerRef.current;
      if (container) {
        container.removeEventListener('touchstart', handleDrawStart);
        container.removeEventListener('touchmove', handleDrawMove);
        container.removeEventListener('touchend', handleDrawEnd);
        container.removeEventListener('mousedown', handleDrawStart);
        container.removeEventListener('mousemove', handleDrawMove);
        container.removeEventListener('mouseup', handleDrawEnd);
      }
      
      if (mapInstanceRef.current) {
        mapInstanceRef.current.off('click', handleMapClick);
        mapInstanceRef.current.destroy();
      }
    };
  }, [userLat, userLng]);

  // Use ref to access latest mode in event handlers
  const modeRef = useRef(drawMode);
  useEffect(() => {
    modeRef.current = drawMode;
  }, [drawMode]);

  useEffect(() => {
    isCalculatingRef.current = isCalculating;
  }, [isCalculating]);

  useEffect(() => {
    snapToRoadRef.current = snapToRoad;
  }, [snapToRoad]); // This one is redundant now since we have the other effect handling logic, but keeping ref update is fine or merge it.
  // Actually, I should remove the redundant ref update since the new useEffect handles it.


  // --- Map Drag Lock Effect & Mode Cleanup ---
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    
    if (drawMode === 'draw') {
        map.setStatus({ dragEnable: false });
    } else {
        map.setStatus({ dragEnable: true });
        
        // Clean up hand drawing state when switching back to waypoint
        isDrawingRef.current = false;
        currentDrawPathRef.current = [];
        if (tempPolylineRef.current) {
            tempPolylineRef.current.setMap(null);
            tempPolylineRef.current = null;
        }
    }
  }, [drawMode]);

  // ===== Helpers =====
  
  const calculateDistance = (p1: RoutePoint, p2: RoutePoint): number => {
    if (amapRef.current?.GeometryUtil) {
      return amapRef.current.GeometryUtil.distance(
        [p1.lng, p1.lat],
        [p2.lng, p2.lat]
      );
    }

    // 降级：Haversine 公式
    const R = 6371e3; // 地球半径（米）
    const φ1 = p1.lat * Math.PI / 180;
    const φ2 = p2.lat * Math.PI / 180;
    const Δφ = (p2.lat - p1.lat) * Math.PI / 180;
    const Δλ = (p2.lng - p1.lng) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  /**
   * 计算路径的各项指标
   * @param path 路径点数组
   */
  function calculateMetrics(path: RoutePoint[]) {
    if (!path || path.length < 2) {
      setDistance(0);
      setTotalTime(0);
      return;
    }

    let distance = 0;
    
    // 计算总距离
    for (let i = 0; i < path.length - 1; i++) {
      const d = calculateDistance(path[i], path[i + 1]);
      distance += d;
    }

    // 转换为公里
    const distanceKm = distance / 1000;
    
    // 估算时间（假设跑步配速 6 min/km = 10 km/h）
    const avgSpeed = 10; // km/h
    const timeHours = distanceKm / avgSpeed;
    const timeMinutes = timeHours * 60;

    setDistance(distanceKm);
    setTotalTime(timeMinutes);

    console.log(`📊 路径指标: ${distanceKm.toFixed(2)}km, 预计${timeMinutes.toFixed(0)}分钟`);
  }

  const getPointFromEvent = (e: any): RoutePoint => {
    if (e.lnglat) {
      return { lng: e.lnglat.lng, lat: e.lnglat.lat };
    }
    const map = mapInstanceRef.current;
    if (!map) return { lng: 0, lat: 0 };

    const AMap = (window as any).AMap;
    const rect = e.target.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    const pixel = new AMap.Pixel(x, y);
    const lnglat = map.containerToLngLat(pixel);
    return { lng: lnglat.lng, lat: lnglat.lat };
  };

  const checkLoopClosure = (pts: RoutePoint[]) => {
      if (pts.length < 3) {
          setIsLoopClosed(false);
          return false;
      }
      const start = pts[0];
      const end = pts[pts.length - 1];
      const dist = calculateDistance(start, end);
      const isClosed = dist <= 200;
      setIsLoopClosed(isClosed);
      return isClosed;
  };

  // ===== Marker Management =====
  
  // Re-render markers whenever points change
  useEffect(() => {
      const map = mapInstanceRef.current;
      const AMap = (window as any).AMap;
      if (!map || !AMap) return;

      // 1. Clear existing markers
      markersRef.current.forEach(m => m?.setMap(null));
      markersRef.current = [];

      // 2. Render new markers (only for key points)
      points.forEach((point, index) => {
          if (point.isKey) {
              const isLast = index === points.length - 1;
              const marker = new AMap.Marker({
                  position: [point.lng, point.lat],
                  icon: new AMap.Icon({
                      size: new AMap.Size(25, 34),
                      image: '//a.amap.com/jsapi_demos/static/demo-center/icons/poi-marker-default.png',
                      imageSize: new AMap.Size(25, 34)
                  }),
                  offset: new AMap.Pixel(-13, -30),
                  draggable: isLast, // Only the last point is draggable
                  cursor: isLast ? 'move' : 'pointer',
                  extData: { index },
                  zIndex: 100
              });

              // Add Drag Events only if draggable
              if (isLast) {
                  marker.on('dragstart', () => {
                      setIsDragging(true);
                      setDragPointIndex(index);
                  });

                  marker.on('dragging', (e: any) => {
                      const newPos = e.lnglat;
                      setPoints(prev => {
                          const updated = [...prev];
                          updated[index] = { ...updated[index], lng: newPos.lng, lat: newPos.lat };
                          return updated;
                      });
                  });

                  marker.on('dragend', (e: any) => {
                      setIsDragging(false);
                      setDragPointIndex(null);
                      const newPos = e.lnglat;
                      
                      setPoints(prev => {
                          const updated = [...prev];
                          updated[index] = { ...updated[index], lng: newPos.lng, lat: newPos.lat };
                          return updated;
                      });
                  });
              }

              marker.setMap(map);
              markersRef.current.push(marker);
          }
      });
      
      // 3. Draw Lines & Check Loop
      drawRawPolyline(points);
      checkLoopAndRender(points);
      
      // 4. Auto Snap if enabled
      if (snapToRoadRef.current && points.length >= 2) {
          // Check if we should snap:
          // 1. Hand drawn segments (contain non-key points) -> Always snap
          // 2. Point mode (all key points) -> Only snap if loop is closed
          
          const hasHandDrawn = points.some(p => !p.isKey);
          
          // Check loop closure (logic duplicated from checkLoopClosure to avoid double state update side effects, 
          // though state update is safe in React batching)
          let isClosed = false;
          if (points.length >= 3) {
             const start = points[0];
             const end = points[points.length - 1];
             if (calculateDistance(start, end) <= 200) {
                 isClosed = true;
             }
          }
          
          if (hasHandDrawn || isClosed) {
              performSnapToRoad(points);
          } else {
              // Not ready to snap yet, clear previous snap if any
              setSnappedPath([]);
              if (snappedPolylineRef.current) snappedPolylineRef.current.setMap(null);
              // Ensure raw line is visible
              if (rawPolylineRef.current) rawPolylineRef.current.show();
          }
      } else {
          setSnappedPath([]);
          if (snappedPolylineRef.current) snappedPolylineRef.current.setMap(null);
      }

  }, [points]);

  // Effect to re-snap when toggle changes
  useEffect(() => {
      snapToRoadRef.current = snapToRoad;
      if (snapToRoad && points.length >= 2) {
          performSnapToRoad(points);
      } else if (!snapToRoad) {
          setSnappedPath([]);
          if (snappedPolylineRef.current) snappedPolylineRef.current.setMap(null);
          if (rawPolylineRef.current) rawPolylineRef.current.show();
      }
  }, [snapToRoad]);

  const checkLoopAndRender = (pts: RoutePoint[]) => {
      const map = mapInstanceRef.current;
      const AMap = (window as any).AMap;
      if (!map || !AMap) return;

      // Reset Polygon & Closure Line
      if (polygonRef.current) {
          polygonRef.current.setMap(null);
          polygonRef.current = null;
      }
      if (closurePolylineRef.current) {
          closurePolylineRef.current.setMap(null);
          closurePolylineRef.current = null;
      }
      setIsLoopClosed(false);

      if (pts.length < 3) return;

      const start = pts[0];
      const end = pts[pts.length - 1];
      const dist = calculateDistance(start, end);
      
      // If closed (<200m)
      if (dist <= 200) {
          setIsLoopClosed(true);
          
          // Render Area
          const path = pts.map(p => [p.lng, p.lat]);
          polygonRef.current = new AMap.Polygon({
              path: path,
              fillColor: '#10b981', // Green
              fillOpacity: 0.2,
              strokeColor: '#10b981',
              strokeWeight: 0, // Hide polygon stroke to avoid conflict with dashed line
              strokeOpacity: 0,
              zIndex: 15
          });
          polygonRef.current.setMap(map);

          // Render Dashed Closing Line
          closurePolylineRef.current = new AMap.Polyline({
              path: [[start.lng, start.lat], [end.lng, end.lat]],
              strokeColor: '#10b981',
              strokeWeight: 2,
              strokeOpacity: 0.8,
              strokeStyle: 'dashed',
              zIndex: 16
          });
          closurePolylineRef.current.setMap(map);
          
          // Calculate Area
          if (AMap.GeometryUtil?.ringArea) {
              const areaVal = AMap.GeometryUtil.ringArea(path);
              setArea(Math.round(areaVal));
          }
      } else {
          setArea(0);
      }
  };

  // 1. Waypoint Mode: Add points
  const handleMapClick = useCallback((e: any) => {
    if (showTutorialRef.current) return; // Block interaction during tutorial
    if (modeRef.current !== 'point' || isCalculatingRef.current) return;
    if (isDragging) return; 

    const newPoint: RoutePoint = { 
      lng: e.lnglat.lng, 
      lat: e.lnglat.lat,
      isKey: true // Manually added points are always key nodes
    };

    setPoints(prev => {
        // If we have points, check if we should close the loop or just add
        const updatedPoints = [...prev, newPoint];
        return updatedPoints;
    });

  }, [isDragging]); 


  const drawRawPolyline = (pts: RoutePoint[]) => {
      const map = mapInstanceRef.current;
      const AMap = (window as any).AMap;
      if (!map || !AMap || pts.length < 2) return;

      if (rawPolylineRef.current) {
          rawPolylineRef.current.setMap(null);
      }

      rawPolylineRef.current = new AMap.Polyline({
          path: pts.map(p => [p.lng, p.lat]),
          strokeColor: '#3b82f6', // Blue 500 (Same as snapped for consistency, or keep slate but solid)
          strokeWeight: 4,
          strokeOpacity: 0.8,
          strokeStyle: 'solid',
          zIndex: 10
      });
      rawPolylineRef.current.setMap(map);
  };

  const drawSnappedPolyline = (path: RoutePoint[]) => {
      const map = mapInstanceRef.current;
      const AMap = (window as any).AMap;
      if (!map || !AMap || path.length < 2) return;

      if (snappedPolylineRef.current) {
          snappedPolylineRef.current.setMap(null);
      }

      snappedPolylineRef.current = new AMap.Polyline({
          path: path.map(p => [p.lng, p.lat]),
          strokeColor: '#3b82f6', // Blue 500
          strokeWeight: 4,
          strokeOpacity: 0.9,
          strokeStyle: 'solid',
          zIndex: 20
      });
      snappedPolylineRef.current.setMap(map);
  };

  /**
   * 检查网络连接
   */
  async function checkNetworkConnection(): Promise<boolean> {
      if (typeof window === 'undefined') return true;
      
      // 检查浏览器在线状态
      if (!navigator.onLine) {
          console.error('❌ 网络未连接');
          return false;
      }
      
      // 尝试 ping 高德服务器
      try {
          // Use a simple fetch to a reliable endpoint or the map key endpoint
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const response = await fetch(`https://restapi.amap.com/v3/ip?key=${AMAP_KEY}`, {
              method: 'GET',
              cache: 'no-cache',
              signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          return response.ok;
      } catch (error) {
          console.error('❌ 网络检测失败:', error);
          // If fetch fails (e.g. CORS), we might still be online, but API is unreachable.
          // However, for snapping we need API access.
          return false;
      }
  }

  /**
   * 带重试的路径规划
   */
  async function snapPathToRoadWithRetry(
      path: RoutePoint[], 
      mode: 'walking' | 'driving' | 'riding' = 'walking', 
      maxRetries: number = 2
  ): Promise<RoutePoint[]> {
      let lastError: Error | null = null;
      let currentPath = [...path];
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
              if (attempt > 0) {
                  console.log(`🔄 重试路径规划 (${attempt}/${maxRetries})`);
                  // 重试前等待一段时间
                  await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
              }
              
              const result = await snapPathToRoad(currentPath, mode);
              return result;
              
          } catch (error: any) {
              lastError = error as Error;
              console.error(`❌ 第 ${attempt + 1} 次尝试失败:`, error);
              
              // 如果是超时错误，尝试减少途经点
              if ((error.message.includes('超时') || error.message.includes('timeout')) && currentPath.length > 4) {
                  console.log('⚠️ 超时，尝试减少路径点数量');
                  currentPath = sampleWaypoints(currentPath, Math.floor(currentPath.length / 2));
              }
          }
      }
      
      throw lastError || new Error('路径规划失败');
  }

  const performSnapToRoad = async (pts: RoutePoint[]) => {
      if (!snapToRoadRef.current) return;
      
      // Check network first
      const isOnline = await checkNetworkConnection();
      if (!isOnline) {
           toast({ title: "网络异常", description: "无法连接到地图服务，已保留原始路径", variant: "destructive" });
           return;
      }
      
      try {
          setIsCalculating(true);
          // Simplify before snap
          const simplified = simplifyPath(pts, 10);
          
          // ✅ 使用带重试的版本
          const snapped = await snapPathToRoadWithRetry(simplified, 'walking', 2);
          
          setSnappedPath(snapped);
          drawSnappedPolyline(snapped);
          
          // Hide raw line if snapped successfully
          if (rawPolylineRef.current) {
              rawPolylineRef.current.hide();
          }
      } catch (error: any) {
          console.error('Snap failed', error);
          const errorMsg = error instanceof Error ? error.message : '未知错误';
          toast({ title: "吸附失败", description: `⚠️ ${errorMsg}\n已保留原始路径`, variant: "destructive" });
          
          // Fallback: Ensure raw line is visible
          if (rawPolylineRef.current) rawPolylineRef.current.show();
          setSnappedPath([]);
          if (snappedPolylineRef.current) snappedPolylineRef.current.setMap(null);
          
      } finally {
          setIsCalculating(false);
      }
  };

  // 2. Freehand Mode Logic
  const handleDrawStart = useCallback((e: any) => {
      if (showTutorialRef.current) return; // Block interaction during tutorial
      if (modeRef.current !== 'draw' || isCalculatingRef.current) return;
      
      isDrawingRef.current = true;
      currentDrawPathRef.current = [];
      
      // Auto-connect to last waypoint if exists
      if (points.length > 0) {
          const lastPoint = points[points.length - 1];
          currentDrawPathRef.current.push(lastPoint);
          console.log('✅ Connecting to last waypoint');
      } else {
          const start = getPointFromEvent(e);
          currentDrawPathRef.current.push(start);
      }
  }, [points]);

  const handleDrawMove = useCallback((e: any) => {
      if (!isDrawingRef.current || !mapInstanceRef.current || !(window as any).AMap) return;
      
      const AMap = (window as any).AMap;
      const map = mapInstanceRef.current;
      const point = getPointFromEvent(e);
      
      // Sampling > 3m
      const lastPoint = currentDrawPathRef.current[currentDrawPathRef.current.length - 1];
      if (lastPoint) {
          if (calculateDistance(lastPoint, point) < 3) return;
      }
      
      currentDrawPathRef.current.push(point);
      
      // Draw Temp Line
      if (tempPolylineRef.current) {
          tempPolylineRef.current.setPath(currentDrawPathRef.current.map(p => [p.lng, p.lat]));
      } else {
          tempPolylineRef.current = new AMap.Polyline({
              path: currentDrawPathRef.current.map(p => [p.lng, p.lat]),
              strokeColor: '#3b82f6',
              strokeWeight: 4,
              strokeOpacity: 0.6,
              strokeStyle: 'dashed',
              zIndex: 50
          });
          tempPolylineRef.current.setMap(map);
      }
  }, []);

  // Douglas-Peucker Simplification
  const simplifyPath = (points: RoutePoint[], tolerance: number): RoutePoint[] => {
      if (points.length < 3) return points;
      
      const perpendicularDistance = (point: RoutePoint, lineStart: RoutePoint, lineEnd: RoutePoint) => {
          const { lng: x, lat: y } = point;
          const { lng: x1, lat: y1 } = lineStart;
          const { lng: x2, lat: y2 } = lineEnd;
          
          const A = x - x1;
          const B = y - y1;
          const C = x2 - x1;
          const D = y2 - y1;
          
          const dot = A * C + B * D;
          const lenSq = C * C + D * D;
          const param = lenSq !== 0 ? dot / lenSq : -1;
          
          let xx, yy;
          
          if (param < 0) {
            xx = x1;
            yy = y1;
          } else if (param > 1) {
            xx = x2;
            yy = y2;
          } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
          }
          
          const dx = x - xx;
          const dy = y - yy;
          
          return Math.sqrt(dx * dx + dy * dy) * 111000;
      };

      const simplify = (pts: RoutePoint[]): RoutePoint[] => {
        if (pts.length < 3) return pts;
        let maxDist = 0;
        let index = 0;
        const end = pts.length - 1;
        for (let i = 1; i < end; i++) {
          const dist = perpendicularDistance(pts[i], pts[0], pts[end]);
          if (dist > maxDist) {
            index = i;
            maxDist = dist;
          }
        }
        if (maxDist > tolerance) {
          const left = simplify(pts.slice(0, index + 1));
          const right = simplify(pts.slice(index));
          return [...left.slice(0, -1), ...right];
        } else {
          return [pts[0], pts[end]];
        }
      };

      return simplify(points);
  };

  /** 
   * 计算角度变化 
   */ 
  function calculateAngleChange(p1: RoutePoint, p2: RoutePoint, p3: RoutePoint): number { 
      const angle1 = Math.atan2(p2.lat - p1.lat, p2.lng - p1.lng); 
      const angle2 = Math.atan2(p3.lat - p2.lat, p3.lng - p2.lng); 
      
      let diff = (angle2 - angle1) * 180 / Math.PI; 
      
      // 归一化到 -180 到 180 
      while (diff > 180) diff -= 360; 
      while (diff < -180) diff += 360; 
      
      return diff; 
  }

  const sampleWaypoints = (points: RoutePoint[], maxCount: number): RoutePoint[] => {
      if (points.length <= maxCount) return points;
  
      const sampled: RoutePoint[] = [points[0]]; // 保留第一个点 
      
      // 🎯 基于角度变化采样（保留转折点） 
      // const step = Math.floor(points.length / maxCount); 
      // Simplified loop to iterate all points and filter
      // Actually the previous implementation logic in prompt seems a bit complex for 'step' usage combined with angle.
      // Let's iterate all intermediate points and pick those with high angle change, 
      // then downsample if still too many.
      
      const candidates: RoutePoint[] = [];
      
      for (let i = 1; i < points.length - 1; i++) {
          const angle = calculateAngleChange(points[i-1], points[i], points[i+1]);
          if (Math.abs(angle) > 30) {
              candidates.push(points[i]);
          }
      }
      
      // If we have room, add more uniform points
      // Or if candidates are too many, sample from candidates
      
      // Let's stick to the prompt's hybrid approach but fix the loop logic slightly for clarity
      // Prompt logic: iterate with step, but check angles.
      
      // Let's implement a robust version:
      // 1. Always keep start and end.
      // 2. Calculate "importance" of each intermediate point (angle change).
      // 3. Sort by importance and pick top (maxCount - 2).
      // 4. Sort back by index to maintain order.
      
      // Actually, let's follow the prompt's provided code structure for consistency with user expectation
      
      const step = Math.max(1, Math.floor(points.length / maxCount));
      const tempSampled: RoutePoint[] = [points[0]];
      
      for (let i = 1; i < points.length - 1; i++) {
          // Check if we should keep this point based on step OR angle
          const isStepPoint = (i % step === 0);
          
          const angle = calculateAngleChange(
              points[i - 1], 
              points[i], 
              points[i + 1] 
          ); 
          const isTurnPoint = Math.abs(angle) > 30;
          
          if (isStepPoint || isTurnPoint) {
              tempSampled.push(points[i]);
          }
      }
      
      tempSampled.push(points[points.length - 1]);
      
      // If still too many, uniform sample from the tempSampled
      if (tempSampled.length > maxCount) {
           const finalSampled: RoutePoint[] = [];
           const finalStep = (tempSampled.length - 1) / (maxCount - 1);
           
           for (let i = 0; i < maxCount; i++) {
               const index = Math.round(i * finalStep);
               finalSampled.push(tempSampled[Math.min(index, tempSampled.length - 1)]);
           }
           return finalSampled;
      }
      
      return tempSampled;
  };

  const snapWalkingSegment = async (start: RoutePoint, end: RoutePoint): Promise<RoutePoint[]> => {
      const AMap = (window as any).AMap;
      // We assume plugin is loaded since it is in init list
      
      return new Promise((resolve) => {
          // Use a shorter timeout for segments (e.g. 5s)
          const timeoutId = setTimeout(() => {
              console.warn('Segment snap timeout, using straight line');
              resolve([start, end]);
          }, 5000);

          const walking = new AMap.Walking({
              hideMarkers: true,
              autoFitView: false
          });

          walking.search(
              new AMap.LngLat(start.lng, start.lat),
              new AMap.LngLat(end.lng, end.lat),
              (status: string, result: any) => {
                  clearTimeout(timeoutId);
                  if (status === 'complete' && result.routes && result.routes.length > 0) {
                      const route = result.routes[0];
                      const segmentPath: RoutePoint[] = [];
                      
                      // Extract steps
                      if (route.steps) {
                          route.steps.forEach((step: any) => {
                              if (step.path) {
                                  step.path.forEach((p: any) => {
                                      segmentPath.push({ lng: p.lng, lat: p.lat });
                                  });
                              }
                          });
                      } else if (route.path) {
                          // Fallback
                          route.path.forEach((p: any) => {
                               segmentPath.push({ lng: p.lng, lat: p.lat });
                          });
                      }
                      
                      if (segmentPath.length > 0) {
                          resolve(segmentPath);
                          return;
                      }
                  }
                  
                  // Fallback
                  resolve([start, end]);
              }
          );
      });
  };

  const snapWalkingPathSegmented = async (path: RoutePoint[]): Promise<RoutePoint[]> => {
      console.log('🔄 使用分段规划...');
      const result: RoutePoint[] = [];
      if (path.length === 0) return [];
      
      result.push(path[0]);
      
      for (let i = 0; i < path.length - 1; i++) {
          const start = path[i];
          const end = path[i+1];
          
          // Optimization: If distance is very short (<10m), straight line
          if (calculateDistance(start, end) < 10) {
              result.push(end);
              continue;
          }
          
          try {
              const segment = await snapWalkingSegment(start, end);
              // segment includes start and end usually.
              // We append segment.slice(1) to avoid duplicating start
              if (segment.length > 0) {
                  // Check if first point matches last point of result
                  // It should, but if API returns slightly diff point?
                  result.push(...segment.slice(1));
              } else {
                  result.push(end);
              }
          } catch (e) {
              console.error('Segment failed', e);
              result.push(end);
          }
      }
      
      return result;
  };

  const snapPathToRoad = async (
    path: RoutePoint[], 
    mode: 'walking' | 'driving' | 'riding' = 'walking'
  ): Promise<RoutePoint[]> => {
      if (!mapInstanceRef.current || !(window as any).AMap || path.length < 2) {
        throw new Error('地图未初始化或路径点不足');
      }
      
      console.log(`🚀 开始路径规划: ${mode} 模式, 路径点数: ${path.length}`);

      if (mode === 'walking' && path.length > 2) {
        return snapWalkingPathSegmented(path);
      }

      return snapPathSingleMode(path, mode);
  };

  const snapPathSingleMode = async (
    path: RoutePoint[], 
    mode: 'walking' | 'driving' | 'riding' = 'walking'
  ): Promise<RoutePoint[]> => {
      if (!mapInstanceRef.current || !(window as any).AMap || path.length < 2) {
        throw new Error('地图未初始化或路径点不足');
      }
      
      console.log(`🚀 开始路径规划: ${mode} 模式, 路径点数: ${path.length}`);

      return new Promise((resolve, reject) => {
        // 🔑 延长超时时间，并添加详细错误信息
        const timeoutId = setTimeout(() => {
           console.error('❌ 路径规划超时');
           reject(new Error('路径规划超时（30秒）。可能原因：\n1. 网络连接较慢\n2. 途经点过多\n3. 距离过远'));
        }, 30000); // 改为30秒

        const pluginName = mode === 'walking' ? 'AMap.Walking' : 
                           mode === 'riding' ? 'AMap.Riding' : 
                           'AMap.Driving';

        // ✅ 检查插件是否已加载
        const AMap = (window as any).AMap;
        const map = mapInstanceRef.current;
        
        // Ensure AMap object is available
        if (!AMap) {
             clearTimeout(timeoutId);
             reject(new Error('AMap 对象丢失'));
             return;
        }

        if (!AMap[mode === 'walking' ? 'Walking' : mode === 'riding' ? 'Riding' : 'Driving']) {
             console.log('📦 插件未加载，开始加载...');
        }

        map.plugin(pluginName, () => {
          console.log('✅ 插件加载成功:', pluginName);
          
          const start = path[0];
          const end = path[path.length - 1];
          let waypoints = path.slice(1, -1);
          
          // 🎯 智能采样：根据距离动态调整途经点数量
          const maxWaypoints = 12; // 降低到12个，提高成功率
          if (waypoints.length > maxWaypoints) {
              console.log(`⚠️ 途经点过多 (${waypoints.length})，采样到 ${maxWaypoints} 个`);
              waypoints = sampleWaypoints(waypoints, maxWaypoints);
          }
          
          // 🎯 检查距离是否合理
          // Need to calculate total distance first to check > 50km
          let totalDist = 0;
          for(let i=0; i<path.length-1; i++) {
              totalDist += calculateDistance(path[i], path[i+1]);
          }

          if (totalDist > 50000) { // 超过50公里
             clearTimeout(timeoutId);
             reject(new Error(`路径过长 (${(totalDist/1000).toFixed(1)}km)，建议分段规划`));
             return;
          }

          const startLngLat = new AMap.LngLat(start.lng, start.lat);
          const endLngLat = new AMap.LngLat(end.lng, end.lat);
          const waypointsLngLat = waypoints.map((p: any) => new AMap.LngLat(p.lng, p.lat));
          
          console.log(`� 起点: [${start.lng.toFixed(4)}, ${start.lat.toFixed(4)}]`);
          console.log(`📍 终点: [${end.lng.toFixed(4)}, ${end.lat.toFixed(4)}]`);
          console.log(`📍 途经点: ${waypointsLngLat.length} 个`);
          console.log(`📏 总距离: ${(totalDist/1000).toFixed(2)} km`);

          // 🚀 创建路径规划实例
          let routePlanner;
          if (mode === 'walking') {
             routePlanner = new AMap.Walking({ map, hideMarkers: true, autoFitView: false });
          } else if (mode === 'riding') {
             routePlanner = new AMap.Riding({ map, hideMarkers: true, autoFitView: false });
          } else {
             routePlanner = new AMap.Driving({ 
                map, 
                hideMarkers: true, 
                autoFitView: false, 
                showTraffic: false,
                policy: AMap.DrivingPolicy.LEAST_TIME 
             });
          }
          
          // 🎯 发起请求
          const startTime = Date.now();

          routePlanner.search(startLngLat, endLngLat, { waypoints: waypointsLngLat }, (status: string, result: any) => {
             clearTimeout(timeoutId);
             const elapsedTime = Date.now() - startTime;
             
             console.log(`⏱️ 规划耗时: ${elapsedTime}ms`);
             console.log('📊 响应状态:', status);
             
             if (status !== 'complete') {
               console.error('❌ 规划失败:', result);
               let errorMsg = '路径规划失败';
               switch (status) {
                 case 'no_data': errorMsg = '无法规划路径：起终点可能无连通道路'; break;
                 case 'error': errorMsg = `规划出错：${result?.info || '未知错误'}`; break;
                 default: errorMsg = `规划失败：${result?.info || status}`;
               }
               reject(new Error(errorMsg));
               return;
             }

             if (!result.routes || result.routes.length === 0) {
                reject(new Error('未找到可用路线'));
                return;
             }

             try {
                const route = result.routes[0];
                const snappedPath: RoutePoint[] = [];
                
                if (route.steps && Array.isArray(route.steps)) {
                   route.steps.forEach((step: any) => {
                     if (step.path && Array.isArray(step.path)) {
                       step.path.forEach((lnglat: any) => {
                         const lng = lnglat.lng !== undefined ? lnglat.lng : lnglat[0];
                         const lat = lnglat.lat !== undefined ? lnglat.lat : lnglat[1];
                         if (lng && lat) snappedPath.push({ lng, lat });
                       });
                     }
                   });
                } else if (route.path && Array.isArray(route.path)) {
                   route.path.forEach((lnglat: any) => {
                     const lng = lnglat.lng !== undefined ? lnglat.lng : lnglat[0];
                     const lat = lnglat.lat !== undefined ? lnglat.lat : lnglat[1];
                     if (lng && lat) snappedPath.push({ lng, lat });
                   });
                }
                
                if (snappedPath.length === 0) {
                   throw new Error('未能提取路径坐标');
                }
                
                console.log(`✅ 吸附成功: ${path.length}点 → ${snappedPath.length}点`);
                resolve(snappedPath);
             } catch (err) {
                console.error('❌ 解析路径失败:', err);
                reject(err);
             }
          });
        });
      });
  };

  const handleDrawEnd = useCallback(async () => {
      if (!isDrawingRef.current) return;
      
      isDrawingRef.current = false;

      // Clear temp line
      if (tempPolylineRef.current) {
        tempPolylineRef.current.setMap(null);
        tempPolylineRef.current = null;
      }
      
      const drawnPath = [...currentDrawPathRef.current];
      
      if (drawnPath.length < 2) {
        console.warn('手绘路径点数不足');
        currentDrawPathRef.current = [];
        return;
      }

      // 1. Simplify
      let simplified = simplifyPath(drawnPath, 10);
      
      // 2. Mark Key Points
      // We mark the last point as Key (draggable/connectable)
      // The intermediate points are just geometry
      const processedPoints = simplified.map((p, i) => ({
          ...p,
          isKey: i === simplified.length - 1 // Only last point is key
      }));

      // 3. Append to main Points
      setPoints(prev => [...prev, ...processedPoints]);
      
      // 4. Auto Switch to Point Mode
      setDrawMode('point');
      toast({ title: "已切换至打点模式", description: "继续点击地图添加点位" });
      
      currentDrawPathRef.current = [];
      
  }, []);

  // Sync Metrics
  useEffect(() => {
    // Metric calculation is now unified
    calculateMetrics(points);
  }, [points]);
  
  // Undo/Redo/Clear Logic
  const handleUndo = useCallback(() => {
      if (points.length > 0) {
          // Find last key point
          let lastKeyIndex = -1;
          for (let i = points.length - 1; i >= 0; i--) {
              if (points[i].isKey) {
                  lastKeyIndex = i;
                  break;
              }
          }
          
          if (lastKeyIndex !== -1) {
              // If the last point is a key point, we want to remove it AND the segment leading to it.
              // So we need to find the previous key point.
              
              let prevKeyIndex = -1;
              for (let i = lastKeyIndex - 1; i >= 0; i--) {
                  if (points[i].isKey) {
                      prevKeyIndex = i;
                      break;
                  }
              }
              
              // If there was a previous key point, slice up to it (inclusive).
              // This effectively removes the last key point and all points (segment) after the previous key point.
              if (prevKeyIndex !== -1) {
                  setPoints(points.slice(0, prevKeyIndex + 1));
              } else {
                  // If no previous key point (i.e., this was the only key point or first point), clear all.
                  setPoints([]);
              }
          } else {
               // Fallback: If no key points found (shouldn't happen with current logic), just remove last point
               setPoints(prev => prev.slice(0, -1));
          }
      }
  }, [points]);

  const handleRedo = () => {
      // Not implemented for new logic yet
  };

  const handleClear = useCallback(() => {
      // Clear Markers
      markersRef.current.forEach(m => m?.setMap(null));
      markersRef.current = [];
      
      // Clear Lines
      if (rawPolylineRef.current) rawPolylineRef.current.setMap(null);
      if (snappedPolylineRef.current) snappedPolylineRef.current.setMap(null);
      if (polygonRef.current) polygonRef.current.setMap(null);
      if (closurePolylineRef.current) closurePolylineRef.current.setMap(null);
      
      // Reset State
      setPoints([]);
      setSnappedPath([]);
      setIsLoopClosed(false);
      setDistance(0);
      setArea(0);
      setIsCalculating(false);
  }, []);

  // Mode Switching
  const handleModeChange = useCallback((newMode: 'point' | 'draw') => {
      setDrawMode(newMode);
  }, []);

  // Combined Metrics Calculation (Waypoints + Freehand)
  // DEPRECATED: Replaced by simpler effect above
  /* 
  useEffect(() => {
      // Aggregate all points for metrics
      let allPoints: RoutePoint[] = [];
      
      if (snappedPath.length > 0) {
          allPoints = [...snappedPath];
      } else {
          allPoints = [...points];
      }
      
      // Append drawn paths
      drawnPaths.forEach(path => {
          allPoints = [...allPoints, ...path];
      });
      
      calculateMetrics(allPoints);
      
      // Note: Loop closure check is complex with mixed modes, 
      // primarily relying on waypoint loop check for now.
      
  }, [points, snappedPath]);
  */


  // Helper to generate SVG Path from RoutePoints
  const generateSvgPath = (points: RoutePoint[]): string => {
    if (points.length < 2) return "";
    
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    points.forEach(p => {
        minLat = Math.min(minLat, p.lat);
        maxLat = Math.max(maxLat, p.lat);
        minLng = Math.min(minLng, p.lng);
        maxLng = Math.max(maxLng, p.lng);
    });

    const latSpan = maxLat - minLat;
    const lngSpan = maxLng - minLng;
    const maxSpan = Math.max(latSpan, lngSpan);
    
    if (maxSpan === 0) return "";

    const normalize = (val: number, min: number) => ((val - min) / maxSpan) * 80 + 10; // 10-90 padding

    const pathData = points.map((p, i) => {
        // SVG coordinate system: Y is down. So flip lat.
        const x = normalize(p.lng, minLng);
        const y = 100 - normalize(p.lat, minLat);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(" ");

    return pathData;
  };

  const handleSaveClick = () => {
      if (currentPath.length < 2) {
          toast({ title: "路线太短", description: "请先添加更多点位。", variant: "destructive" });
          return;
      }
      setPreviewPath(generateSvgPath(currentPath));
      setShowSaveDrawer(true);
  };

  const handleConfirmSave = async (name: string) => {
      setLoadingSave(true);
      try {
          const payload = {
              id: isEditing && editingRoute ? editingRoute.id : undefined,
              name,
              points: currentPath,
              distance: distance / 1000, // km
              capture_area: area / 1000000 // sq km
          };

          const method = isEditing ? 'PUT' : 'POST';
          const res = await fetch('/api/routes', {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `保存失败: ${res.status}`);
          }

          setShowSaveDrawer(false);
          setShowSuccessDialog(true);
          
          // Reset edit state if updating
          if (isEditing) {
              setIsEditing(false);
              setEditingRoute(null);
          }
          
          // Clear the map after successful save
          handleClear();

      } catch (error: any) {
          console.error(error);
          toast({ title: "错误", description: error.message || "保存路线失败。", variant: "destructive" });
      } finally {
          setLoadingSave(false);
      }
  };

  const handleEditRoute = (route: Route) => {
      // Load route into planner
      const routePoints = route.waypoints as RoutePoint[];
      setPoints(routePoints);
      setDrawMode('point'); // Switch to waypoint mode for editing standard routes
      
      // Draw the route
      drawRawPolyline(routePoints);
      
      // If it has enough points, try to snap it or just keep it raw?
      // For now, just load as raw waypoints.
      // If it was a closed loop, we should check loop closure
      checkLoopClosure(routePoints);
      
      // Set edit state
      setIsEditing(true);
      setEditingRoute(route);
      
      // Close sheet
      setShowMyRoutes(false);
      
      // Center map on route
      if (mapInstanceRef.current && routePoints.length > 0) {
          const center = [routePoints[0].lng, routePoints[0].lat];
          mapInstanceRef.current.setZoomAndCenter(16, center);
      }
      
      toast({ title: "编辑模式", description: `正在编辑 "${route.name}"` });
  };

  const handleStartRun = (route: Route) => {
      const points = route.waypoints as RoutePoint[];
      useGameStore.getState().setGhostPath(points.map(p => [p.lat, p.lng]));
      useGameStore.getState().setSmartRunStarting(true);
      
      // Go back to the map (which is usually the previous page)
      // If we came from /game, back() works.
      // If direct link, we might need push.
      if (window.history.length > 1) {
          router.back();
      } else {
          router.push('/game');
      }
  };



  return (
    <div className="relative w-full h-[100dvh] overflow-hidden flex flex-col pointer-events-none max-w-[480px] mx-auto shadow-2xl bg-slate-900">
       {/* Fullscreen Map Container */}
       <div 
         id="map-container" 
         ref={mapContainerRef} 
         className="absolute inset-0 h-full w-full z-0 pointer-events-auto" 
         style={{ zIndex: 0 }}
       />
       
       {/* Tutorial Overlay */}
       <PlannerTutorial 
         forceShow={showTutorial} 
         onClose={() => setShowTutorial(false)} 
       />

       {/* Loading UI */}
       {!isMapReady && ( 
         <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-50"> 
           <div className="text-white text-center"> 
             <svg className="animate-spin h-12 w-12 mx-auto mb-4" viewBox="0 0 24 24"> 
               <circle className="opacity-25" cx="12" cy="12" r="10" 
                       stroke="currentColor" strokeWidth="4" fill="none" /> 
               <path className="opacity-75" fill="currentColor" 
                     d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /> 
             </svg> 
             <p className="text-lg">地图加载中...</p> 
           </div> 
         </div> 
       )}

       {/* Components */}
       <SaveRouteModal 
         isOpen={showSaveDrawer} 
         onClose={() => setShowSaveDrawer(false)}
         onSave={handleConfirmSave}
         distance={distance}
         area={area / 1000000}
         initialName={isEditing ? editingRoute?.name : ''}
         mode={isEditing ? 'update' : 'save'}
         loading={loadingSave}
       />
       
       <SaveSuccessDialog
         open={showSuccessDialog}
         onOpenChange={setShowSuccessDialog}
         onContinue={() => setShowSuccessDialog(false)}
         onViewList={() => {
             setShowSuccessDialog(false);
             setShowMyRoutes(true);
         }}
       />

       <MyRoutesSheet 
         open={showMyRoutes}
         onOpenChange={setShowMyRoutes}
         onEdit={handleEditRoute}
         onDelete={() => {}} // State updates in component
         onStartRun={handleStartRun}
       />

       {/* Calculating Indicator */}
       {isCalculating && ( 
         <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 
                         bg-blue-500 text-white px-4 py-2 rounded-full 
                         shadow-lg flex items-center gap-2"> 
           <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"> 
             <circle className="opacity-25" cx="12" cy="12" r="10" 
                     stroke="currentColor" strokeWidth="4" fill="none" /> 
             <path className="opacity-75" fill="currentColor" 
                   d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /> 
           </svg> 
           <span>正在规划路径...</span> 
         </div> 
       )} 

       {/* HUD Info Panel */}
       <div className="absolute top-4 left-4 right-4 z-20 pointer-events-auto"> 
         <div id="planner-hud" className="bg-slate-800/90 backdrop-blur-sm rounded-lg p-4 shadow-xl"> 
           <div className="grid grid-cols-2 gap-4"> 
             <div> 
              <p className="text-slate-400 text-sm">距离</p> 
              <p className="text-white text-2xl font-bold"> 
                {distance.toFixed(2)} km 
              </p> 
            </div> 
            <div> 
               <p className="text-slate-400 text-sm">预计时间</p> 
               <p className="text-white text-2xl font-bold"> 
                 {Math.floor(totalTime)} 分钟 
               </p> 
             </div> 
           </div> 
         </div> 
         
         {/* Top Right Controls (My Routes, Help, Exit) */}
          <div className="absolute top-0 right-0 flex gap-2 -mt-2 -mr-2">
             <button 
                 onClick={() => setShowTutorial(true)}
                 className="bg-slate-800/90 backdrop-blur p-2 rounded-full text-white/60 hover:text-white transition-all shadow-lg"
             >
                 <HelpCircle className="w-5 h-5" />
             </button>
             <button 
                 onClick={() => setShowMyRoutes(true)}
                 className="bg-slate-800/90 backdrop-blur p-2 rounded-full text-white/60 hover:text-white transition-all shadow-lg"
             >
                 <List className="w-5 h-5" />
             </button>
             <button onClick={() => router.back()} className="bg-slate-800/90 backdrop-blur p-2 rounded-full text-white/60 hover:text-white hover:bg-red-500/20 transition-all shadow-lg">
                 <X className="w-5 h-5" />
             </button>
          </div>
       </div>

       {/* Bottom Control Bar */}
       <div className="absolute bottom-0 left-0 right-0 z-30 
                       bg-slate-900/95 backdrop-blur-sm border-t border-slate-700 p-4 pointer-events-auto"> 
         <div className="flex items-center justify-between gap-4"> 
           {/* Mode Switch */} 
           <div className="flex gap-2"> 
             <button 
               onClick={() => handleModeChange('point')} 
               className={`px-4 py-2 rounded-lg font-medium transition-all ${ 
                 drawMode === 'point' 
                   ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50' 
                   : 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
               }`} 
             > 
               打点 
             </button> 
             <button 
              id="planner-draw-btn"
              onClick={() => handleModeChange('draw')} 
              className={`px-4 py-2 rounded-lg font-medium transition-all ${ 
                drawMode === 'draw' 
                   ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50' 
                   : 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
               }`} 
             > 
               手绘 
             </button> 
           </div> 
   
           {/* Snap Toggle */} 
          <label id="planner-snap-toggle" className="flex items-center gap-2 cursor-pointer"> 
            <input 
              type="checkbox" 
               checked={snapToRoad} 
               onChange={(e) => setSnapToRoad(e.target.checked)} 
               className="w-5 h-5 rounded" 
             /> 
             <span className="text-white text-sm">路网吸附</span> 
           </label> 
   
           {/* Actions */} 
          <div id="planner-tools" className="flex gap-2"> 
            <button 
             onClick={handleUndo} 
              disabled={points.length === 0} 
              className="p-2 rounded-lg bg-slate-700 text-slate-300 
                         hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed" 
            > 
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"> 
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                       d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /> 
               </svg> 
             </button> 
             <button 
               onClick={handleClear} 
               className="p-2 rounded-lg bg-red-600 text-white hover:bg-red-700" 
             > 
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"> 
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                       d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /> 
               </svg> 
             </button>
             <button 
               onClick={handleSaveClick}
               className="p-2 rounded-lg bg-green-600 text-white hover:bg-green-700" 
             >
                <Save className="w-5 h-5" />
             </button>
           </div> 
         </div> 
       </div> 
    </div>
  );
}
