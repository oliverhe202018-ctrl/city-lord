"use client";

import { Crown, Medal } from 'lucide-react';
import { formatArea } from '@/lib/citylord/area-utils';
import { useMemo } from 'react';

interface ProvinceRankItemProps {
  rank: number;
  name: string;
  score: number;
}

const TOP_THREE_STYLES = [
  {
    bg: "bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent",
    border: "border-amber-500/30",
    badge: "bg-amber-500 text-black",
    icon: <Crown className="h-4 w-4 text-amber-400" />,
  },
  {
    bg: "bg-gradient-to-r from-slate-400/20 via-slate-400/10 to-transparent",
    border: "border-slate-400/30",
    badge: "bg-slate-400 text-black",
    icon: <Medal className="h-4 w-4 text-slate-300" />,
  },
  {
    bg: "bg-gradient-to-r from-amber-700/20 via-amber-700/10 to-transparent",
    border: "border-amber-700/30",
    badge: "bg-amber-700 text-white",
    icon: <Medal className="h-4 w-4 text-amber-600" />,
  },
];

export function ProvinceRankItem({ rank, name, score }: ProvinceRankItemProps) {
  const scoreDisplay = useMemo(() => formatArea(score), [score]);
  const isTop3 = rank <= 3;
  const style = isTop3 ? TOP_THREE_STYLES[rank - 1] : null;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
        style
          ? `${style.bg} ${style.border}`
          : "border-white/5 bg-white/5"
      }`}
    >
      <div className="flex w-8 items-center justify-center">
        {style?.icon ?? (
          <span className="text-sm font-bold text-white/40">#{rank}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={`font-bold truncate ${isTop3 ? "text-white" : "text-white/80"}`}>
          {name}
        </p>
      </div>

      <div className="text-right">
        <div className="flex items-center justify-end gap-1 text-white">
          <span className={`font-bold text-lg ${isTop3 ? "text-amber-400" : ""}`}>
            {scoreDisplay.value}
          </span>
        </div>
        <p className="text-[10px] text-white/40">{scoreDisplay.unit}</p>
      </div>
    </div>
  );
}
