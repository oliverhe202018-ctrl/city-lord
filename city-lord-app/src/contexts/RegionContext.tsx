
"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

// 定义 Region 的数据结构
export interface Region {
  regionType: "city" | "county";
  cityName: string;
  countyName?: string;
  province?: string;
  adcode?: string;
  centerLngLat: [number, number];
  lastFixCenter?: [number, number]; // 用于“回到定位”按钮
}

// 定义 Context 的数据结构
interface RegionContextType {
  region: Region | null;
  setRegion: (region: Region) => void;
  updateRegion: (updates: Partial<Region>) => void;
}

// 创建 Context
const RegionContext = createContext<RegionContextType | undefined>(undefined);

// 创建 Provider 组件
export const RegionProvider = ({ children }: { children: ReactNode }) => {
  const [region, setRegionState] = useState<Region | null>(null);

  const setRegion = useCallback((newRegion: Region) => {
    setRegionState(newRegion);
  }, []);

  const updateRegion = useCallback((updates: Partial<Region>) => {
    setRegionState(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  return (
    <RegionContext.Provider value={{ region, setRegion, updateRegion }}>
      {children}
    </RegionContext.Provider>
  );
};

// 创建自定义 Hook
export const useRegion = () => {
  const context = useContext(RegionContext);
  if (context === undefined) {
    throw new Error('useRegion must be used within a RegionProvider');
  }
  return context;
};
