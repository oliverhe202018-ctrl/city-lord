"use client";

import React from 'react';
import { useMap } from '@/components/map/AMapContext';
import { Button } from '@/components/ui/button';
import { LocateFixedIcon, Plus, Minus, Gamepad2, Users, User, Loader2, Layers } from 'lucide-react';
import Link from 'next/link';

export const MapControls = () => {
  const {
    map,
    viewMode,
    setViewMode,
    centerMap,
    locationStatus,
    isTracking,
    showKingdom,
    toggleKingdom,
  } = useMap();

  const isLocating = locationStatus === 'locating' || locationStatus === 'initializing';

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
    setViewMode?.(viewMode === 'individual' ? 'faction' : 'individual');
  };

  return (
    <div className="absolute bottom-60 right-4 z-10 flex flex-col gap-4 items-center pointer-events-auto">
      {/* Kingdom Layer Toggle */}
      <Button
        variant="outline"
        size="icon"
        onClick={toggleKingdom}
        className={`h-12 w-12 rounded-full backdrop-blur-sm shadow-lg transition-all border-white/20 ${showKingdom ? 'bg-amber-500/50 text-white hover:bg-amber-500/70' : 'bg-background/30 text-white/50 hover:bg-background/50'}`}
        title={showKingdom ? "隐藏领地" : "显示领地"}
      >
        <Layers className="h-6 w-6" />
        <span className="sr-only">图层控制</span>
      </Button>

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

      {/* Location Button with Tracking Indicator */}
      <Button
        variant="outline"
        size="icon"
        onClick={handleLocate}
        disabled={isLocating}
        className={`h-12 w-12 rounded-full backdrop-blur-sm shadow-lg transition-all ${isTracking
          ? 'bg-primary/70 hover:bg-primary/90 border-primary text-white'
          : 'bg-background/30 hover:bg-background/50 border-white/20 text-white'
          }`}
        title={isTracking ? "跟随模式 (已开启)" : "点击回到当前位置"}
      >
        {isLocating ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <LocateFixedIcon className={`h-6 w-6 ${isTracking ? 'text-white' : ''}`} />
        )}
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
