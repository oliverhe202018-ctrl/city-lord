"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAMap } from "@/components/map/AMapProvider";
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
  RotateCcw
} from "lucide-react";
import { toast } from "sonner";
import { useGameStore } from "@/store/useGameStore";
import { calculateSmartRoute } from "@/lib/utils/routing";
import { latLngToCell } from "h3-js";
import AMapLoader from "@amap/amap-jsapi-loader";

// Security Config
const AMAP_KEY = process.env.NEXT_PUBLIC_AMAP_KEY || "2f65c697074e0d4c8270195561578e06";

interface RoutePoint {
  lat: number;
  lng: number;
}

interface PlannerState {
  waypoints: RoutePoint[];
  history: RoutePoint[][]; // Undo/Redo stack
  historyIndex: number;
}

export default function SmartPlannerPage() {
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const polygonRef = useRef<any>(null); // For loop closure
  const markersRef = useRef<any[]>([]);
  
  const userLat = useGameStore((state) => state.latitude);
  const userLng = useGameStore((state) => state.longitude);

  // --- State ---
  const [mode, setMode] = useState<'waypoint' | 'freehand'>('waypoint');
  const [snapToRoad, setSnapToRoad] = useState(false);
  const [showTerritories, setShowTerritories] = useState(true);
  const [isLoopClosed, setIsLoopClosed] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  
  // Undo/Redo System
  const [history, setHistory] = useState<RoutePoint[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Computed Metrics
  const [distance, setDistance] = useState(0);
  const [area, setArea] = useState(0); // Estimated capture area

  const currentPath = history[historyIndex] || [];

  // --- Map Initialization ---
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (typeof window !== "undefined") {
      (window as any)._AMapSecurityConfig = {
        securityJsCode: 'e827ba611fad4802c48dd900d01eb4bf',
      }
    }

    AMapLoader.load({
      key: AMAP_KEY,
      version: "2.0",
      plugins: ["AMap.Scale", "AMap.ToolBar", "AMap.Walking", "AMap.GeometryUtil"],
    }).then((AMap) => {
      const map = new AMap.Map(mapContainerRef.current, {
        viewMode: "2D",
        zoom: 17,
        center: [userLng || 116.397, userLat || 39.909],
        mapStyle: "amap://styles/dark",
        skyColor: '#1f2029'
      });

      mapInstanceRef.current = map;

      // Click Handler for Waypoint Mode
      map.on('click', handleMapClick);
      
      // Drag Handler for Freehand Mode (using mousemove/touchmove)
      map.on('mousemove', handleMapDrag);
      map.on('mousedown', () => { if (mode === 'freehand') setIsDragging(true); });
      map.on('mouseup', () => { if (mode === 'freehand') setIsDragging(false); });
      
      // Fix Gesture Conflict: Disable map drag when in freehand mode
      // We'll update this in the effect below when mode changes

    }).catch(e => console.error(e));

    return () => {
      mapInstanceRef.current?.destroy();
    };
  }, [userLat, userLng]); // Re-init if user loc changes significantly? Maybe not needed.

  // --- Map Drag Lock Effect ---
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    
    if (mode === 'freehand') {
        map.setStatus({ dragEnable: false });
    } else {
        map.setStatus({ dragEnable: true });
    }
  }, [mode]);

  // --- Handlers ---
  
  // Push new state to history
  const pushState = (newPath: RoutePoint[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newPath);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    calculateMetrics(newPath);
    checkLoopClosure(newPath);
  };

  const [isDragging, setIsDragging] = useState(false);

  const handleMapClick = async (e: any) => {
    if (mode !== 'waypoint') return;
    
    const { lng, lat } = e.lnglat;
    const newPoint = { lat, lng };
    let newPath = [...currentPath];

    if (snapToRoad && newPath.length > 0) {
      // Async Snap Logic
      setIsCalculating(true);
      try {
        const lastPoint = newPath[newPath.length - 1];
        const AMap = (window as any).AMap;
        // Simple 2-point walking route
        const route = await calculateSmartRoute(['dummy'], lastPoint, AMap); // Refactor calc to be generic?
        // Actually calculateSmartRoute is for Hexes. We need raw point-to-point.
        // Let's implement a quick point-to-point snap helper inside or reuse logic
        const segment = await calculateRoadSegment(lastPoint, newPoint);
        newPath = [...newPath, ...segment];
      } catch (err) {
        console.warn("Snap failed", err);
        newPath.push(newPoint);
      } finally {
        setIsCalculating(false);
      }
    } else {
      newPath.push(newPoint);
    }
    
    pushState(newPath);
  };

  const handleMapDrag = (e: any) => {
    if (mode !== 'freehand' || !isDragging) return;
    // Throttle?
    const { lng, lat } = e.lnglat;
    const newPath = [...currentPath, { lat, lng }];
    // Update visual directly for performance, commit on mouseup?
    // For now simple commit:
    // pushState(newPath); // Too heavy for drag. Should use local state then commit on mouseup.
    // Let's implement optimized freehand later. For V1, freehand adds points rapidly.
  };

  // Helper: Road Segment Calculation
  const calculateRoadSegment = (start: RoutePoint, end: RoutePoint): Promise<RoutePoint[]> => {
     return new Promise((resolve) => {
        const AMap = (window as any).AMap;
        const walking = new AMap.Walking({ hideMarkers: true });
        walking.search(
            new AMap.LngLat(start.lng, start.lat), 
            new AMap.LngLat(end.lng, end.lat), 
            (status: string, result: any) => {
                if (status === 'complete' && result.routes?.[0]) {
                    const steps = result.routes[0].steps;
                    const path: RoutePoint[] = [];
                    steps.forEach((step: any) => {
                        step.path.forEach((p: any) => {
                            path.push({ lat: p.getLat(), lng: p.getLng() });
                        });
                    });
                    resolve(path);
                } else {
                    resolve([end]); // Fallback
                }
            }
        );
     });
  };

  // --- Rendering ---
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const AMap = (window as any).AMap;
    const pathCoords = currentPath.map(p => [p.lng, p.lat]);

    // 1. Draw Polyline
    if (polylineRef.current) map.remove(polylineRef.current);
    polylineRef.current = new AMap.Polyline({
        path: pathCoords,
        strokeColor: isCalculating ? "#9ca3af" : "#3b82f6", // Grey if calculating, Blue otherwise
        strokeWeight: 6,
        strokeOpacity: isCalculating ? 0.5 : 0.8,
        strokeStyle: isCalculating ? "dashed" : "solid",
        strokeDasharray: isCalculating ? [10, 10] : undefined,
        lineJoin: 'round',
        lineCap: 'round',
        zIndex: 50,
        showDir: true
    });
    map.add(polylineRef.current);

    // 2. Draw Polygon if Closed
    if (polygonRef.current) map.remove(polygonRef.current);
    if (isLoopClosed && pathCoords.length > 2) {
        polygonRef.current = new AMap.Polygon({
            path: pathCoords,
            fillColor: "#22c55e", // Green
            fillOpacity: 0.2,
            strokeColor: "#22c55e",
            strokeWeight: 2,
            zIndex: 40
        });
        map.add(polygonRef.current);
    }

    // 3. Draw Markers (Start/End)
    markersRef.current.forEach(m => map.remove(m));
    markersRef.current = [];
    
    if (pathCoords.length > 0) {
        // Start
        const startMarker = new AMap.Marker({
            position: pathCoords[0],
            content: `<div class="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-lg"></div>`,
            offset: new AMap.Pixel(-8, -8)
        });
        map.add(startMarker);
        markersRef.current.push(startMarker);

        // End (if not closed)
        if (!isLoopClosed) {
            const endMarker = new AMap.Marker({
                position: pathCoords[pathCoords.length - 1],
                content: `<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-pulse"></div>`,
                offset: new AMap.Pixel(-8, -8)
            });
            map.add(endMarker);
            markersRef.current.push(endMarker);
        }
    }

  }, [currentPath, isLoopClosed, isCalculating]);

  // --- Logic ---
  const checkLoopClosure = (path: RoutePoint[]) => {
      if (path.length < 3) {
          setIsLoopClosed(false);
          return;
      }
      const start = path[0];
      const end = path[path.length - 1];
      const AMap = (window as any).AMap;
      
      // Calculate distance
      const d = AMap.GeometryUtil.distance(
          [start.lng, start.lat], 
          [end.lng, end.lat]
      );

      if (d < 50) { // 50 meters threshold
          setIsLoopClosed(true);
      } else {
          setIsLoopClosed(false);
      }
  };

  const calculateMetrics = (path: RoutePoint[]) => {
      const AMap = (window as any).AMap;
      if (!AMap || path.length < 2) {
          setDistance(0);
          setArea(0);
          return;
      }
      const coords = path.map(p => [p.lng, p.lat]);
      const d = AMap.GeometryUtil.distanceOfLine(coords);
      setDistance(Math.round(d));

      if (isLoopClosed) {
          const a = AMap.GeometryUtil.ringArea(coords);
          setArea(Math.round(a));
      } else {
          setArea(0);
      }
  };

  const handleSave = () => {
      if (currentPath.length < 2) {
          toast.error("路线太短");
          return;
      }
      // Save to Ghost Path
      useGameStore.getState().setGhostPath(currentPath.map(p => [p.lat, p.lng]));
      useGameStore.getState().setSmartRunStarting(true);
      toast.success("路线已保存，准备出发！");
      router.back();
  };

  const handleUndo = () => {
      if (historyIndex > 0) {
          setHistoryIndex(historyIndex - 1);
          const prevPath = history[historyIndex - 1];
          calculateMetrics(prevPath);
          checkLoopClosure(prevPath);
      }
  };

  const handleRedo = () => {
      if (historyIndex < history.length - 1) {
          setHistoryIndex(historyIndex + 1);
          const nextPath = history[historyIndex + 1];
          calculateMetrics(nextPath);
          checkLoopClosure(nextPath);
      }
  };

  const handleClear = () => {
      pushState([]);
      setIsLoopClosed(false);
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden flex flex-col">
       {/* Fullscreen Map Container */}
       <div ref={mapContainerRef} className="absolute inset-0 z-0" />

       {/* Top HUD (Data Island) */}
       <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
           <div className="flex items-center bg-black/80 backdrop-blur-md rounded-full px-6 py-3 border border-white/10 shadow-2xl gap-8">
               <div className="flex flex-col items-center">
                   <span className="text-[10px] text-white/40 font-bold tracking-wider uppercase">DISTANCE</span>
                   <span className="text-xl font-mono font-bold text-white">
                       {(distance / 1000).toFixed(2)} <span className="text-xs text-white/50">km</span>
                   </span>
               </div>
               <div className="w-px h-8 bg-white/10" />
               <div className="flex flex-col items-center">
                   <span className="text-[10px] text-white/40 font-bold tracking-wider uppercase">CAPTURE</span>
                   <span className="text-xl font-mono font-bold text-green-400">
                       {(area / 10000).toFixed(2)} <span className="text-xs text-green-500/50">ha</span>
                   </span>
               </div>
           </div>
       </div>

       {/* Bottom Control Dock (Wave Dock) */}
       <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 w-full max-w-sm px-4">
           {/* Snap Toggle */}
           <div className="flex justify-center mb-4 relative">
               <button 
                 onClick={() => setSnapToRoad(!snapToRoad)}
                 className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                     snapToRoad ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' : 'bg-black/40 text-white/40 border border-white/10'
                 }`}
               >
                   {isCalculating ? <RotateCcw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                   {isCalculating ? "Calculating..." : (snapToRoad ? "Snap On" : "Snap Off")}
               </button>
           </div>

           {/* Main Dock */}
           <div className="relative bg-black/90 backdrop-blur-xl rounded-[2.5rem] border border-white/10 p-2 shadow-2xl flex items-center justify-between h-20 px-6">
               
               {/* Left Tools */}
               <div className="flex items-center gap-4">
                   <button onClick={handleUndo} disabled={historyIndex === 0} className="text-white/60 hover:text-white disabled:opacity-30 transition-colors">
                       <Undo className="w-6 h-6" />
                   </button>
                   <button onClick={handleRedo} disabled={historyIndex === history.length - 1} className="text-white/60 hover:text-white disabled:opacity-30 transition-colors">
                       <Redo className="w-6 h-6" />
                   </button>
               </div>

               {/* Center Action Button (Floating) */}
               <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                   <button 
                     onClick={() => setMode(mode === 'waypoint' ? 'freehand' : 'waypoint')}
                     className={`w-20 h-20 rounded-full flex flex-col items-center justify-center border-4 border-black shadow-2xl transition-all active:scale-95 ${
                         mode === 'waypoint' 
                         ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' 
                         : 'bg-gradient-to-br from-purple-500 to-purple-600 text-white'
                     }`}
                   >
                       {isCalculating ? (
                           <RotateCcw className="w-8 h-8 animate-spin" />
                       ) : (
                           <Pen className="w-8 h-8 mb-1" />
                       )}
                       <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">
                           {mode === 'waypoint' ? 'Point' : 'Draw'}
                       </span>
                   </button>
               </div>

               {/* Right Tools */}
               <div className="flex items-center gap-4">
                   <button 
                     onClick={() => setShowTerritories(!showTerritories)}
                     className={`${showTerritories ? 'text-green-400' : 'text-white/60'} hover:text-white transition-colors`}
                   >
                       <Hexagon className="w-6 h-6" />
                   </button>
                   <button 
                     onClick={handleSave}
                     className="text-white hover:text-green-400 transition-colors bg-white/10 p-2 rounded-full"
                   >
                       <Save className="w-5 h-5" />
                   </button>
               </div>
           </div>
           
           {/* Exit Button */}
           <div className="absolute -top-16 right-0">
               <button onClick={() => router.back()} className="bg-black/60 backdrop-blur border border-white/10 p-2 rounded-full text-white/60 hover:text-white hover:bg-red-500/20 transition-all">
                   <X className="w-6 h-6" />
               </button>
           </div>
       </div>
    </div>
  );
}
