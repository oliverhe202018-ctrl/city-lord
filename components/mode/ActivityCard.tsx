
'use client';

import { RunningRecord } from '@/data/running-records';
import { MapPin, Clock, Zap, Footprints } from 'lucide-react';

interface ActivityCardProps {
  record: RunningRecord;
}

export function ActivityCard({ record }: ActivityCardProps) {
  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 transition-all hover:border-white/20">
      <p className="text-xs text-white/50 font-medium mb-3">{record.date}</p>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-white">{record.distance.toFixed(2)}</span>
          <span className="text-lg font-medium text-white/60">km</span>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-white">{record.hexesCaptured} 个地块</p>
          <p className="text-xs text-white/50">被占领</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 text-center border-t border-white/10 pt-3">
        <div>
          <p className="text-sm text-white/60">时长</p>
          <p className="text-base font-semibold text-white">{record.duration}</p>
        </div>
        <div>
          <p className="text-sm text-white/60">配速</p>
          <p className="text-base font-semibold text-white">{record.pace}</p>
        </div>
        <div>
          <p className="text-sm text-white/60">卡路里</p>
          <p className="text-base font-semibold text-white">{Math.round(record.distance * 65)}</p>
        </div>
      </div>
    </div>
  );
}
