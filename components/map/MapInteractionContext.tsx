"use client"

import { createContext, useContext } from 'react';
import type { ExtTerritory } from '@/types/city';

/**
 * MapInteractionContext: 低频交互状态
 * 
 * 与 GPS 高频更新完全隔离。
 * 仅当用户主动操作（点击领地、切换模式）时才变化。
 */
export interface MapInteractionContextProps {
  // 领地选择
  selectedTerritory?: ExtTerritory | null;
  setSelectedTerritory?: (t: ExtTerritory | null) => void;

  // 领地详情抽屉状态
  isDetailSheetOpen?: boolean;
  setIsDetailSheetOpen?: (isOpen: boolean) => void;

  // 视图模式
  viewMode: 'individual' | 'faction';
  setViewMode: (mode: 'individual' | 'faction') => void;

  // 领地图层模式
  kingdomMode?: 'personal' | 'club';
  setKingdomMode?: (mode: 'personal' | 'club') => void;

  // 领地图层可见性
  showKingdom?: boolean;
  toggleKingdom?: () => void;

  // 迷雾图层
  // 迷雾图层
  showFog?: boolean;
  toggleFog?: () => void;

  /** [NEW] 打开领地详情抽屉 */
  openTerritoryDetailDrawer?: (id: string) => void;
}

export const MapInteractionCtx = createContext<MapInteractionContextProps | undefined>(undefined);

export const MapInteractionProvider = MapInteractionCtx.Provider;

/**
 * useMapInteraction: 仅订阅低频交互状态
 * 
 * 不会因 GPS 更新而触发重渲染。
 * TerritoryLayer / TerritoryInfoBar / TerritoryDetailSheet 应使用此 hook。
 */
export function useMapInteraction() {
  const context = useContext(MapInteractionCtx);
  if (context === undefined) {
    throw new Error('useMapInteraction must be used within MapRoot');
  }
  return context;
}
