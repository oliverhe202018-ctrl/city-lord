"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// 1. 定义 Context 类型
interface AMapContextType {
  map: any | null;
  AMap: any | null;
  setMap: (map: any) => void;
  setAMap: (AMap: any) => void;
}

// 2. 创建 Context
const AMapContext = createContext<AMapContextType | null>(null);

// 3. 导出 Hook (供 AMapViewWithProvider 使用)
export const useAMap = () => {
  const context = useContext(AMapContext);
  if (!context) {
    // 为了防止报错，如果 context 为空先返回空对象，或者抛出友好的错误
    // 这里为了稳健，我们允许它暂时为空，但在组件里要注意判空
    throw new Error('useAMap must be used within an AMapProvider');
  }
  return context;
};

// 4. 定义 Provider 组件
export function AMapProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<any>(null);
  const [AMapInstance, setAMapInstance] = useState<any>(null);

  // 这里可以放地图初始化的逻辑，或者仅仅作为一个状态容器
  // 为了让项目先跑起来，我们先把它作为一个纯粹的状态容器
  
  const value = {
    map,
    AMap: AMapInstance,
    setMap,
    setAMap: setAMapInstance,
  };

  return (
    <AMapContext.Provider value={value}>
      {children}
    </AMapContext.Provider>
  );
}

export default AMapProvider;