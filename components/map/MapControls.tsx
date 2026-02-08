"use client";

import React, { useState } from 'react';
import { useAMap } from '@/components/map/AMapProvider';
import { useRegion } from '@/contexts/RegionContext';
import { Button } from '@/components/ui/button';
import { LocateFixedIcon, Plus, Minus, Gamepad2, Users, User, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { toast } from 'sonner';
import gcoord from 'gcoord';

export const MapControls = () => {
  const { map, viewMode, setViewMode, centerMap, locationState } = useAMap();
  const { region } = useRegion();
  
  const handleLocate = () => {
    centerMap();
  };

  const handleZoomIn = () => {
    map?.zoomIn();
  };

  const handleZoomOut = () => {
    map?.zoomOut();
  };
  
  const toggleViewMode = () => {
      setViewMode(viewMode === 'individual' ? 'faction' : 'individual');
  };

  return (
    <div className="absolute bottom-60 right-4 z-10 flex flex-col gap-4 items-center">
      <Button
        variant="outline"
        size="icon"
        onClick={toggleViewMode}
        className={`h-12 w-12 rounded-full backdrop-blur-sm shadow-lg transition-all border-white/20 ${viewMode === 'faction' ? 'bg-purple-500/50 text-white hover:bg-purple-500/70' : 'bg-background/30 text-white hover:bg-background/50'}`}
        title={viewMode === 'individual' ? "切换至阵营视图" : "切换至个人视图"}
      >
        {viewMode === 'individual' ? <User className="h-6 w-6" /> : <Users className="h-6 w-6" />}
        <span className="sr-only">切换视图</span>
      </Button>

      <Button
        variant="outline"
        size="icon"
        onClick={handleLocate}
        className="h-12 w-12 rounded-full bg-background/30 backdrop-blur-sm shadow-lg transition-all hover:bg-background/50 border-white/20 text-white"
      >
        <LocateFixedIcon className="h-6 w-6" />
        <span className="sr-only">回到定位</span>
      </Button>

      <div className="flex flex-col gap-2 items-center">
        <Link href="/game/runner">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full bg-cyan-500/20 backdrop-blur-sm shadow-lg transition-all hover:bg-cyan-500/40 border-cyan-500/50 text-cyan-400"
          >
            <Gamepad2 className="h-5 w-5" />
            <span className="sr-only">Mini Game</span>
          </Button>
        </Link>
        <Button
          variant="outline"
          size="icon"
          onClick={handleZoomIn}
          className="h-10 w-10 rounded-full bg-background/30 backdrop-blur-sm shadow-lg transition-all hover:bg-background/50 border-white/20 text-white"
        >
          <Plus className="h-5 w-5" />
          <span className="sr-only">放大</span>
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleZoomOut}
          className="h-10 w-10 rounded-full bg-background/30 backdrop-blur-sm shadow-lg transition-all hover:bg-background/50 border-white/20 text-white"
        >
          <Minus className="h-5 w-5" />
          <span className="sr-only">缩小</span>
        </Button>
      </div>
    </div>
  );
};
