"use client"

import React, { useState, useEffect } from 'react';
import { useRegion } from '@/contexts/RegionContext';
import { Map, Users, Trophy, Zap, TrendingUp, Award, Calendar, Clock } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from '@/components/ui/drawer';

interface ModeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ModeDrawer({ isOpen, onClose }: ModeDrawerProps) {
  const { region } = useRegion();
  const { cityName, countyName } = region || {};
  const locationName = (cityName && cityName !== 'undefined' ? cityName : '') || 
                      (countyName && countyName !== 'undefined' ? countyName : '') || 
                      '城市';
  const [snapPoint, setSnapPoint] = useState<number | string | null>(1);

  const modes = [
    {
      id: 'single',
      name: '单人挑战',
      description: '独自征服城市领地',
      icon: Map,
      color: 'from-blue-500 to-blue-600',
      badge: 'HOT'
    },
    {
      id: 'private',
      name: '私人房间',
      description: '邀请好友一起跑步',
      icon: Users,
      color: 'from-purple-500 to-purple-600',
      badge: 'NEW'
    },
    {
      id: 'time-trial',
      name: '计时挑战',
      description: '挑战最佳配速',
      icon: Clock,
      color: 'from-orange-500 to-orange-600',
    },
    {
      id: 'survival',
      name: '生存模式',
      description: '体力有限，策略分配',
      icon: Zap,
      color: 'from-yellow-500 to-yellow-600',
    }
  ];

  const handleModeClick = (modeId: string, modeName: string) => {
    console.log(`[Mode] Selected mode: ${modeName}`);
    onClose();
    // Simulate navigation or confirmation dialog
    // In a real app, this would route to a specific page or open a modal
    if (typeof window !== 'undefined') {
        if (modeId === 'time-trial' || modeId === 'single' || modeId === 'survival') {
            // Simple confirmation for demo purposes
            setTimeout(() => {
                alert(`准备开始: ${modeName}`);
            }, 300);
        }
    }
  };

  return (
    <Drawer 
      open={isOpen} 
      onOpenChange={onClose} 
      snapPoints={[0.4, 1]}
      activeSnapPoint={snapPoint}
      onActiveSnapPointChange={setSnapPoint}
      dismissible={true}
    >
      <DrawerContent className="bg-zinc-900/90 border-t border-white/10 rounded-t-[32px] w-full overflow-x-hidden flex flex-col h-[96vh]">
        {/* 顶部拖拽手柄 */}
        <div className="flex justify-center pt-4 pb-2">
          <div className="w-12 h-1.5 bg-white/20 rounded-full" />
        </div>

        <DrawerHeader className="px-6 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <DrawerTitle className="text-white text-2xl font-bold">选择跑步模式</DrawerTitle>
              <p className="text-white/50 text-sm mt-1">选择适合你的跑步方式</p>
            </div>
            <DrawerClose className="p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
              <svg className="w-6 h-6 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </DrawerClose>
          </div>
        </DrawerHeader>

        <div className="px-6 py-4 space-y-3 overflow-y-auto max-h-[calc(85vh-140px)] pb-8 no-scrollbar">
          {modes.map((mode) => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                onClick={() => handleModeClick(mode.id, mode.name)}
                className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group relative overflow-hidden cursor-pointer active:scale-95"
              >
                {mode.badge && (
                  <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-gradient-to-r from-red-500 to-orange-500 text-[10px] font-bold text-white">
                    {mode.badge}
                  </div>
                )}
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${mode.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-white font-bold text-lg">{mode.name}</h3>
                    <p className="text-white/50 text-sm mt-0.5">{mode.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
