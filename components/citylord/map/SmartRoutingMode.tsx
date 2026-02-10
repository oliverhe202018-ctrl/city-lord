"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function SmartRoutingMode() {
  const router = useRouter();

  // Toggle Mode - Redirects to the new Planner Page
  const toggleMode = () => {
    // If we have a back mechanism, use router.push, but maybe we want to preserve state?
    // Actually, planner is a separate page.
    router.push('/game/planner');
  };

  return (
    <>
      {/* Entry Button */}
      <div className="absolute top-48 left-4 z-20 pointer-events-auto">
         <Button
            size="icon"
            onClick={toggleMode}
            className="h-10 w-10 rounded-full shadow-lg transition-all bg-black/60 backdrop-blur-md border border-white/10 text-white hover:bg-black/80"
            title="智能路径规划"
         >
            <Wand2 className="h-5 w-5" />
         </Button>
      </div>
    </>
  );
}

/* Legacy Logic (Reference)
import { useAMap } from "@/components/map/AMapProvider";
import { useState, useEffect } from "react";
import { X, Play, RotateCcw, MapPin, Loader2 } from "lucide-react";
import { latLngToCell, cellToBoundary } from "h3-js";
import { calculateSmartRoute } from "@/lib/utils/routing";
import { toast } from "sonner";
import { useGameStore } from "@/store/useGameStore";

export function SmartRoutingModeLegacy() {
  const { map } = useAMap();
  const [isActive, setIsActive] = useState(false);
  const [selectedHexes, setSelectedHexes] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedRoute, setGeneratedRoute] = useState<any>(null);
  const [routePolyline, setRoutePolyline] = useState<any>(null);
  const [hexPolygons, setHexPolygons] = useState<any[]>([]);
  
  const userLat = useGameStore((state) => state.latitude);
  const userLng = useGameStore((state) => state.longitude);

  // ... (Legacy implementation omitted for brevity)
}
*/
