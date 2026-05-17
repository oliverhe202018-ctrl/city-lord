import React from 'react';
import { cn } from "@/lib/utils";

interface CenterOverlayProps {
  className?: string;
}

export function CenterOverlay({ className }: CenterOverlayProps) {
  return (
    <div 
      className={cn(
        "pointer-events-none absolute left-1/2 top-1/2 z-[100] -translate-x-1/2 -translate-y-1/2",
        className
      )}
    >
      {/* Outer Green Ring with Pulse */}
      <div className="relative flex items-center justify-center w-8 h-8">
        <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" />
        <div className="absolute inset-0 rounded-full border-2 border-green-500 shadow-lg" />
        {/* Crosshair Center Dot */}
        <div className="w-1 h-1 bg-green-500 rounded-full" />
      </div>
    </div>
  );
}
