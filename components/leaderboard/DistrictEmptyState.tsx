"use client";

import { MapPin, ArrowRight } from "lucide-react";

interface DistrictEmptyStateProps {
  onGoToMap: () => void;
}

export function DistrictEmptyState({ onGoToMap }: DistrictEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="relative mb-6">
        <div className="h-20 w-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <MapPin className="h-10 w-10 text-white/20" />
        </div>
        <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-[#39ff14]/10 border border-[#39ff14]/20 flex items-center justify-center">
          <span className="text-xs">?</span>
        </div>
      </div>

      <h3 className="text-base font-bold text-white/80 mb-2 text-center">
        您尚未在任何区县留下足迹
      </h3>
      <p className="text-xs text-white/40 text-center mb-8 max-w-[240px]">
        完成第一次圈地，解锁同城排行榜，看看谁是你身边的最强领主！
      </p>

      <button
        onClick={onGoToMap}
        className="flex items-center gap-2 rounded-full bg-[#39ff14] px-6 py-3 text-sm font-bold text-black shadow-[0_0_20px_rgba(57,255,20,0.3)] transition-all active:scale-[0.96]"
      >
        <ArrowRight className="h-4 w-4" />
        去跑第一圈
      </button>
    </div>
  );
}
