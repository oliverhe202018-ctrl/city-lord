"use client";

import React from 'react';
import { useAMap } from '@/components/map/AMapProvider';
import { useRegion } from '@/contexts/RegionContext';
import { Button } from '@/components/ui/button';
import { LocateFixedIcon, Plus, Minus } from 'lucide-react';

export const MapControls = () => {
  const { map } = useAMap();
  const { region } = useRegion();

  const handleLocate = () => {
    if (map && region?.lastFixCenter) {
      map.setCenter(region.lastFixCenter, true); // Smoothly move to the location
      map.setZoom(15, false, 500);
    }
  };

  const handleZoomIn = () => {
    map?.zoomIn();
  };

  const handleZoomOut = () => {
    map?.zoomOut();
  };

  return (
    <div className="absolute bottom-60 right-4 z-10 flex flex-col gap-4 items-center">
      <Button
        variant="outline"
        size="icon"
        onClick={handleLocate}
        disabled={!region?.lastFixCenter}
        className="h-12 w-12 rounded-full bg-background/30 backdrop-blur-sm shadow-lg transition-all hover:bg-background/50 border-white/20 text-white"
      >
        <LocateFixedIcon className="h-6 w-6" />
        <span className="sr-only">回到定位</span>
      </Button>

      <div className="flex flex-col gap-2 items-center">
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
