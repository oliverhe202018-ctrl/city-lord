"use client";

import React from 'react';
import { useLocationStore } from '@/store/useLocationStore';
import { 
  safeAMapOpenBatteryOptimizationSettings 
} from '@/lib/capacitor/safe-plugins';

interface BatteryOptimizationModalProps {
  onConfirm: () => void;
  onSkip: () => void;
}

export function BatteryOptimizationModal({ onConfirm, onSkip }: BatteryOptimizationModalProps) {
  const visible = useLocationStore(s => s.batteryOptModalVisible);
  const setVisible = useLocationStore(s => s.setBatteryOptModalVisible);

  if (!visible) return null;

  const handleGoToSettings = async () => {
    setVisible(false);
    onConfirm(); // Background silent start
    await safeAMapOpenBatteryOptimizationSettings();
  };

  const handleSkip = () => {
    setVisible(false);
    onSkip(); // Skip and silent start
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900/90 p-6 text-white shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 animate-pulse">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          
          <h3 className="mb-2 text-lg font-bold tracking-tight">电池优化白名单引导</h3>
          <p className="text-sm text-slate-300 leading-relaxed">
            检测到您的手机系统较为激进，为防止关屏后跑步轨迹丢失或领地结算中断，强烈建议将【城市领主】设置为【无限制】或加入【白名单】。
          </p>
        </div>
        
        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={handleGoToSettings}
            className="w-full rounded-2xl bg-amber-500 py-3 text-sm font-bold text-slate-950 transition-all hover:bg-amber-400 active:scale-[0.98] cursor-pointer"
          >
            去设置
          </button>
          <button
            onClick={handleSkip}
            className="w-full rounded-2xl bg-white/5 py-3 text-sm font-medium text-slate-400 transition-all hover:bg-white/10 hover:text-slate-300 active:scale-[0.98] cursor-pointer"
          >
            仍然跳过
          </button>
        </div>
      </div>
    </div>
  );
}
