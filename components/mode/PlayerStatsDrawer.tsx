"use client"

import React from 'react';
import { 
  Trophy, 
  MapPin, 
  Swords, 
  Target, 
  TrendingUp, 
  TrendingDown,
  Clock,
  Footprints,
  Shield
} from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from '@/components/ui/drawer';

interface PlayerStats {
  id: string;
  nickname: string;
  avatar?: string;
  level: number;
  total_score: number;
  territory_area: number;
  territory_ratio: number;
  stolen_lands: number;
  lost_lands: number;
  rivals_defeated: number;
  growth_rate: number;
  status: 'active' | 'offline' | 'running';
}

interface PlayerStatsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  player: PlayerStats | null;
}

export function PlayerStatsDrawer({ isOpen, onClose, player }: PlayerStatsDrawerProps) {
  const [activeTab, setActiveTab] = React.useState("overview");
  const [snapPoint, setSnapPoint] = React.useState<number | string | null>(1);

  if (!player) return null;

  return (
    <Drawer 
      open={isOpen} 
      onOpenChange={onClose} 
      snapPoints={[0.4, 1]}
      activeSnapPoint={snapPoint}
      onActiveSnapPointChange={setSnapPoint}
      dismissible={true}
    >
      <DrawerContent className="bg-zinc-950 border-t border-white/10 h-[96vh]">
        <div className="flex justify-center pt-4 pb-2">
          <div className="w-12 h-1.5 bg-white/20 rounded-full" />
        </div>

        <div className="flex-1 overflow-y-auto pb-8">
          {/* Header Profile */}
          <div className="px-6 pt-4 pb-6 flex flex-col items-center border-b border-white/5">
            <div className="relative mb-4">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 p-[2px]">
                <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center overflow-hidden">
                  {player.avatar ? (
                    <img src={player.avatar} alt={player.nickname} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-bold text-white">{player.nickname[0]}</span>
                  )}
                </div>
              </div>
              <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full border-2 border-zinc-900">
                Lv.{player.level}
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-1">{player.nickname}</h2>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                player.status === 'running' ? 'bg-green-500 animate-pulse' : 
                player.status === 'active' ? 'bg-blue-500' : 'bg-zinc-500'
              }`} />
              <span className="text-white/50 text-sm">
                {player.status === 'running' ? '正在奔跑' : 
                 player.status === 'active' ? '在线' : '离线'}
              </span>
            </div>
          </div>

          {/* Main Stats Grid */}
          <div className="p-6 grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-2 mb-2 text-white/60">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <span className="text-xs">综合得分</span>
              </div>
              <div className="text-2xl font-bold text-white">{player.total_score.toLocaleString()}</div>
            </div>
            
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-2 mb-2 text-white/60">
                <MapPin className="w-4 h-4 text-green-500" />
                <span className="text-xs">领地面积</span>
              </div>
              <div className="text-2xl font-bold text-white">{player.territory_area} km²</div>
              <div className="text-xs text-white/40 mt-1">占比 {player.territory_ratio}%</div>
            </div>
          </div>

          {/* Detailed Stats List */}
          <div className="px-6 space-y-4">
            <h3 className="text-white font-semibold text-sm pl-1">战斗数据</h3>
            
            <div className="bg-white/5 rounded-2xl divide-y divide-white/5 border border-white/5">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                    <Target className="w-4 h-4 text-red-500" />
                  </div>
                  <span className="text-white/80 text-sm">偷取领地</span>
                </div>
                <span className="text-white font-bold">{player.stolen_lands} 块</span>
              </div>

              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                    <Swords className="w-4 h-4 text-orange-500" />
                  </div>
                  <span className="text-white/80 text-sm">击败对手</span>
                </div>
                <span className="text-white font-bold">{player.rivals_defeated} 人</span>
              </div>

              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-purple-500" />
                  </div>
                  <span className="text-white/80 text-sm">增长速率</span>
                </div>
                <span className="text-green-400 font-bold">+{player.growth_rate}%</span>
              </div>

              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-500/20 flex items-center justify-center">
                    <TrendingDown className="w-4 h-4 text-zinc-400" />
                  </div>
                  <span className="text-white/80 text-sm">失去领地</span>
                </div>
                <span className="text-white font-bold">{player.lost_lands} 块</span>
              </div>
            </div>
          </div>

          <div className="px-6 mt-6">
            <button className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
              发起挑战
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
