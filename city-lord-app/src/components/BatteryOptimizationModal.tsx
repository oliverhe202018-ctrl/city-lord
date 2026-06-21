"use client";

import React, { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useLocationStore } from '@/store/useLocationStore';
import { safeAMapOpenBatteryOptimizationSettings, safeAMapIsBatteryOptimizationIgnored } from '@/lib/capacitor/safe-plugins';

interface BatteryOptimizationModalProps {
  onConfirm: () => void;
  onSkip: () => void;
}

export function BatteryOptimizationModal({ onConfirm, onSkip }: BatteryOptimizationModalProps) {
  const visible = useLocationStore(s => s.batteryOptModalVisible);
  const setVisible = useLocationStore(s => s.setBatteryOptModalVisible);

  // [P0 Fix] 监听 App 从后台切回前台事件，自动重新校验电池优化状态
  useEffect(() => {
    if (!visible) return;

    const handleResume = async () => {
      console.log('[BatteryOptModal] App resumed, re-checking battery optimization status');
      const isIgnored = await safeAMapIsBatteryOptimizationIgnored();
      if (isIgnored) {
        console.log('[BatteryOptModal] User has enabled battery optimization, closing modal');
        setVisible(false);
      }
    };

    // 监听 Capacitor resume 事件
    if (Capacitor.isNativePlatform()) {
      Capacitor.addListener('app', 'resume', handleResume);
      return () => {
        Capacitor.removeListener('app', 'resume', handleResume);
      };
    }
  }, [visible, setVisible]);

  // [P0 Fix] 弹窗显示前强制校验底层真实状态，防止状态脱节
  useEffect(() => {
    if (visible) {
      const checkStatus = async () => {
        const isIgnored = await safeAMapIsBatteryOptimizationIgnored();
        if (isIgnored) {
          console.log('[BatteryOptModal] Already in whitelist, auto-closing modal');
          setVisible(false);
        }
      };
      checkStatus();
    }
  }, [visible, setVisible]);

  if (!visible) return null;

  const handleGoToSettings = async () => {
    setVisible(false);
    onConfirm(); // Background silent start
    await safeAMapOpenBatteryOptimizationSettings();
  };

  const handleSkip = () => {
    localStorage.setItem('city-lord-battery-bypass', 'true');
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
          {/* [P1 Fix] 优化按钮文案布局，防止换行溢出 */}
          <button
            onClick={handleGoToSettings}
            className="w-full rounded-2xl bg-amber-500 py-3 px-4 text-sm font-bold text-slate-950 transition-all hover:bg-amber-400 active:scale-[0.98] cursor-pointer flex flex-col items-center gap-0.5"
          >
            <span>去设置</span>
            <span className="text-xs font-medium opacity-80">Ignore Battery Optimizations</span>
          </button>
          <button
            onClick={handleSkip}
            className="w-full rounded-2xl bg-white/5 py-3 text-sm font-medium text-slate-400 transition-all hover:bg-white/10 hover:text-slate-300 active:scale-[0.98] cursor-pointer"
          >
            我已授权，强制跳过
          </button>
        </div>
      </div>
    </div>
  );
}
