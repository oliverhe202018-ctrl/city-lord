"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAMap } from "@/components/map/AMapProvider";
import { PlannerTutorial } from "@/components/citylord/map/PlannerTutorial"; 
import { RouteSaveDrawer } from "@/components/citylord/map/RouteSaveDrawer";
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
  List
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
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

  // Tutorial State
  const [showTutorial, setShowTutorial] = useState(false);

  // Computed Metrics
  const [distance, setDistance] = useState(0);
  const [area, setArea] = useState(0); // Estimated capture area

  // Save/Manage Workflow State
  const [showSaveDrawer, setShowSaveDrawer] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showMyRoutes, setShowMyRoutes] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [previewPath, setPreviewPath] = useState<string>("");

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
      
      // Drag Handler for Freehand Mode
      map.on('mousemove', handleMapDrag);
      map.on('mousedown', () => { if (modeRef.current === 'freehand') setIsDragging(true); });
      map.on('mouseup', () => { 
        if (modeRef.current === 'freehand') {
            setIsDragging(false); 
            // Auto-switch back to waypoint mode after drawing
            setMode('waypoint');
        }
      });
      
    }).catch(e => console.error(e));

    return () => {
      mapInstanceRef.current?.destroy();
    };
  }, [userLat, userLng]);

  // Use ref to access latest mode in event handlers
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

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
    if (modeRef.current !== 'waypoint') return;
    
    const { lng, lat } = e.lnglat;
    const newPoint = { lat, lng };
    
    // Use refs for latest state
    const currentHist = historyRef.current;
    const idx = historyIndexRef.current;
    const path = currentHist[idx] || [];
    let newPath = [...path];

    if (snapToRoad && newPath.length > 0) {
      // Async Snap Logic
      setIsCalculating(true);
      try {
        const lastPoint = newPath[newPath.length - 1];
        const AMap = (window as any).AMap;
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

  // Use ref to access latest state in event handlers
  const historyRef = useRef(history);
  const historyIndexRef = useRef(historyIndex);
  
  useEffect(() => {
    historyRef.current = history;
    historyIndexRef.current = historyIndex;
  }, [history, historyIndex]);

  const handleMapDrag = (e: any) => {
    if (modeRef.current !== 'freehand' || !isDragging) return;
    
    const { lng, lat } = e.lnglat;
    const currentHist = historyRef.current;
    const idx = historyIndexRef.current;
    const path = currentHist[idx] || [];
    
    const newPath = [...path, { lat, lng }];
    
    pushState(newPath); 
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
          toast({ title: "Route too short", description: "Please add more points.", variant: "destructive" });
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
          const res = await fetch('/api/routes/route', {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });

          if (!res.ok) throw new Error('Failed to save route');

          setShowSaveDrawer(false);
          setShowSuccessDialog(true);
          
          // Reset edit state if updating
          if (isEditing) {
              setIsEditing(false);
              setEditingRoute(null);
          }

      } catch (error) {
          console.error(error);
          toast({ title: "Error", description: "Failed to save route.", variant: "destructive" });
      } finally {
          setLoadingSave(false);
      }
  };

  const handleEditRoute = (route: Route) => {
      // Load route into planner
      const points = route.waypoints as RoutePoint[];
      setHistory([points]);
      setHistoryIndex(0);
      calculateMetrics(points);
      checkLoopClosure(points);
      
      // Set edit state
      setIsEditing(true);
      setEditingRoute(route);
      
      // Close sheet
      setShowMyRoutes(false);
      
      // Center map on route
      if (mapInstanceRef.current && points.length > 0) {
          const center = [points[0].lng, points[0].lat];
          mapInstanceRef.current.setZoomAndCenter(16, center);
      }
      
      toast({ title: "Editing Mode", description: `Editing "${route.name}"` });
  };

  const handleStartRun = (route: Route) => {
      const points = route.waypoints as RoutePoint[];
      useGameStore.getState().setGhostPath(points.map(p => [p.lat, p.lng]));
      useGameStore.getState().setSmartRunStarting(true);
      router.push('/game/runner'); // Or just router.back() if runner is main? Assuming runner page.
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

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden flex flex-col">
       {/* Fullscreen Map Container */}
       <div ref={mapContainerRef} className="absolute inset-0 z-0" />
       
       {/* Tutorial Overlay */}
       <PlannerTutorial 
         forceShow={showTutorial} 
         onClose={() => setShowTutorial(false)} 
       />

       {/* Components */}
       <RouteSaveDrawer 
         open={showSaveDrawer} 
         onOpenChange={setShowSaveDrawer}
         onSave={handleConfirmSave}
         distance={distance / 1000}
         captureArea={area / 1000000}
         initialName={isEditing ? editingRoute?.name : ''}
         mode={isEditing ? 'update' : 'save'}
         loading={loadingSave}
         previewPath={previewPath}
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

       {/* Top HUD (Data Island) */}
       <div id="planner-hud" className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex gap-4">
           {isEditing && (
               <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-xs font-bold border border-yellow-500/50 whitespace-nowrap">
                   EDITING: {editingRoute?.name}
               </div>
           )}
           
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
           
           {/* My Routes & Help Button Group */}
           <div className="absolute -right-24 top-1/2 -translate-y-1/2 flex gap-2">
                <button 
                    onClick={() => setShowMyRoutes(true)}
                    className="bg-black/60 backdrop-blur border border-white/10 p-2 rounded-full text-white/60 hover:text-white transition-all"
                >
                    <List className="w-5 h-5" />
                </button>
                <button 
                    onClick={() => setShowTutorial(true)}
                    className="bg-black/60 backdrop-blur border border-white/10 p-2 rounded-full text-white/60 hover:text-white transition-all"
                >
                    <HelpCircle className="w-5 h-5" />
                </button>
           </div>
       </div>

       {/* Bottom Control Dock (Wave Dock) */}
       <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 w-full max-w-sm px-4">
           {/* Snap Toggle */}
           <div id="planner-snap-toggle" className="flex justify-center mb-4 relative">
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
               <div id="planner-tools" className="flex items-center gap-4">
                   <button onClick={handleUndo} disabled={historyIndex === 0} className="text-white/60 hover:text-white disabled:opacity-30 transition-colors">
                       <Undo className="w-6 h-6" />
                   </button>
                   <button onClick={handleRedo} disabled={historyIndex === history.length - 1} className="text-white/60 hover:text-white disabled:opacity-30 transition-colors">
                       <Redo className="w-6 h-6" />
                   </button>
               </div>

               {/* Center Action Button (Floating) */}
               <div id="planner-draw-btn" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
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
                     onClick={handleSaveClick}
                     className={`text-white hover:text-green-400 transition-colors bg-white/10 p-2 rounded-full ${isEditing ? 'text-yellow-400' : ''}`}
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
