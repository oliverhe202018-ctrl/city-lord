"use client";

import React, { useState, useEffect } from "react";
import { useAMap } from "@/components/map/AMapProvider";
import { Button } from "@/components/ui/button";
import { Wand2, X, Play, RotateCcw, MapPin, Loader2 } from "lucide-react";
import { latLngToCell, cellToBoundary } from "h3-js";
import { calculateSmartRoute, RoutePoint } from "@/lib/utils/routing";
import { toast } from "sonner";
import { useGameStore } from "@/store/useGameStore";
import { useRouter } from "next/navigation";

export function SmartRoutingMode() {
  const { map } = useAMap();
  const router = useRouter();
  const [isActive, setIsActive] = useState(false);
  const [selectedHexes, setSelectedHexes] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedRoute, setGeneratedRoute] = useState<any>(null);
  const [routePolyline, setRoutePolyline] = useState<any>(null);
  const [hexPolygons, setHexPolygons] = useState<any[]>([]);
  
  const userLat = useGameStore((state) => state.latitude);
  const userLng = useGameStore((state) => state.longitude);

  // Toggle Mode
  const toggleMode = () => {
    // New Architecture: Redirect to Planner Page
    router.push('/game/planner');
  };

  /* Legacy Logic (Commented out for reference or potential fallback)
  const toggleModeLegacy = () => {
    if (isActive) {
  ...
      clearAll();
      setIsActive(false);
    } else {
      setIsActive(true);
      toast.info("已进入智能规划模式，请点击地图选择地块");
    }
  };

  // Clear everything
  const clearAll = () => {
    setSelectedHexes(new Set());
    setGeneratedRoute(null);
    if (routePolyline) {
      routePolyline.setMap(null);
      setRoutePolyline(null);
    }
    hexPolygons.forEach(p => p.setMap(null));
    setHexPolygons([]);
  };

  // Map Click Handler
  useEffect(() => {
    if (!isActive || !map) return;

    const handleMapClick = (e: any) => {
      const { lng, lat } = e.lnglat;
      const h3Index = latLngToCell(lat, lng, 9); // Use res 9 default
      
      setSelectedHexes(prev => {
        const newSet = new Set(prev);
        if (newSet.has(h3Index)) {
          newSet.delete(h3Index);
        } else {
          newSet.add(h3Index);
        }
        return newSet;
      });
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [isActive, map]);

  // Render Selected Hexes
  useEffect(() => {
    if (!map) return;

    // Clear old
    hexPolygons.forEach(p => p.setMap(null));
    
    if (selectedHexes.size === 0) {
        setHexPolygons([]);
        return;
    }

    const newPolygons = Array.from(selectedHexes).map(h3 => {
      const boundary = cellToBoundary(h3);
      const path = boundary.map(([lat, lng]) => [lng, lat]);
      
      const polygon = new (window as any).AMap.Polygon({
        path,
        fillColor: "#a855f7", // Purple
        fillOpacity: 0.4,
        strokeColor: "#9333ea",
        strokeWeight: 2,
        zIndex: 100,
        bubble: true // Allow click to pass through?
      });
      return polygon;
    });

    map.add(newPolygons);
    setHexPolygons(newPolygons);

  }, [selectedHexes, map]);

  // Generate Route
  const handleGenerate = async () => {
    if (selectedHexes.size < 1) {
      toast.error("请至少选择一个地块");
      return;
    }
    if (!userLat || !userLng) {
      toast.error("无法获取您的当前位置");
      return;
    }

    setIsGenerating(true);
    try {
      const startPoint = { lat: userLat, lng: userLng };
      const indices = Array.from(selectedHexes);
      
      const result = await calculateSmartRoute(indices, startPoint, (window as any).AMap);
      
      setGeneratedRoute(result);
      
      // Render Route
      if (routePolyline) routePolyline.setMap(null);
      
      const path = result.path.map((p: any) => [p.lng, p.lat]);
      const polyline = new (window as any).AMap.Polyline({
        path,
        strokeColor: "#a855f7", // Purple
        strokeWeight: 6,
        strokeOpacity: 0.8,
        lineJoin: 'round',
        lineCap: 'round',
        zIndex: 101,
        showDir: true,
      });
      
      map.add(polyline);
      setRoutePolyline(polyline);
      
      toast.success(`路线生成成功！全程 ${(result.distance / 1000).toFixed(2)} km`);
      
    } catch (e: any) {
      console.error(e);
      toast.error("路线生成失败: " + e.message);
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleStartRun = () => {
      if (generatedRoute) {
          // Store Ghost Path in localStorage for now
          // localStorage.setItem('GHOST_PATH', JSON.stringify(generatedRoute.path));
          
          useGameStore.getState().setGhostPath(generatedRoute.path);
          useGameStore.getState().setSmartRunStarting(true);
          
          toggleMode(); // Close UI
          // router.push('/game/runner?mode=ghost');
      }
  };

  return (
    <>
      {/* Entry Button */}
      <div className="absolute top-48 left-4 z-20 pointer-events-auto">
         <Button
            size="icon"
            onClick={toggleMode}
            className={`h-10 w-10 rounded-full shadow-lg transition-all ${
                isActive 
                ? 'bg-purple-600 text-white hover:bg-purple-700 ring-2 ring-purple-400' 
                : 'bg-black/60 backdrop-blur-md border border-white/10 text-white hover:bg-black/80'
            }`}
            title="智能路径规划"
         >
            <Wand2 className="h-5 w-5" />
         </Button>
      </div>

      {/* Mode UI Overlay */}
      {isActive && (
        <div className="absolute bottom-0 left-0 w-full z-[100] p-4 pointer-events-none mb-[120px]">
           <div className="pointer-events-auto bg-black/80 backdrop-blur-md text-white p-4 rounded-xl border border-purple-500/30 shadow-2xl animate-in slide-in-from-bottom-4 mx-auto max-w-md">
              <div className="flex items-center justify-between mb-2">
                 <h3 className="font-bold text-purple-400 flex items-center gap-2">
                    <Wand2 className="w-4 h-4" /> 智能路径规划
                 </h3>
                 <Button variant="ghost" size="sm" onClick={toggleMode} className="h-8 w-8 p-0 rounded-full hover:bg-white/10 text-white">
                    <X className="w-4 h-4" />
                 </Button>
              </div>
              
              {!generatedRoute ? (
                  <>
                      <p className="text-sm text-white/70 mb-4">
                        请点击地图选择您想要占领的地块 ({selectedHexes.size} 已选)
                      </p>
                      <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1 border-white/20 bg-transparent hover:bg-white/10 text-white"
                            onClick={clearAll}
                          >
                            <RotateCcw className="w-3 h-3 mr-2" /> 重置
                          </Button>
                          <Button 
                            size="sm" 
                            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                            onClick={handleGenerate}
                            disabled={selectedHexes.size === 0 || isGenerating}
                          >
                            {isGenerating ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <MapPin className="w-3 h-3 mr-2" />}
                            {isGenerating ? "生成中..." : "生成路线"}
                          </Button>
                      </div>
                  </>
              ) : (
                  <>
                      <div className="grid grid-cols-2 gap-4 mb-4 text-center">
                          <div className="bg-white/5 rounded-lg p-2">
                              <div className="text-xs text-white/40">总距离</div>
                              <div className="text-lg font-bold font-mono">{(generatedRoute.distance / 1000).toFixed(2)} km</div>
                          </div>
                          <div className="bg-white/5 rounded-lg p-2">
                              <div className="text-xs text-white/40">预计耗时</div>
                              <div className="text-lg font-bold font-mono">{Math.ceil(generatedRoute.duration / 60)} min</div>
                          </div>
                      </div>
                      <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1 border-white/20 bg-transparent hover:bg-white/10 text-white"
                            onClick={() => {
                                setGeneratedRoute(null);
                                if (routePolyline) routePolyline.setMap(null);
                            }}
                          >
                             返回修改
                          </Button>
                          <Button 
                            size="sm" 
                            className="flex-[2] bg-green-600 hover:bg-green-700 text-white font-bold"
                            onClick={handleStartRun}
                          >
                            <Play className="w-4 h-4 mr-2 fill-current" />
                            开始执行
                          </Button>
                      </div>
                  </>
              )}
           </div>
        </div>
      )}
    </>
  );
}
