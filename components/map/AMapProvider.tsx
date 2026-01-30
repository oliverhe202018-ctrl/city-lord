"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AMapContextType {
  map: any | null;
  setMap: (map: any | null) => void;
  isLoaded: boolean;
}

const AMapContext = createContext<AMapContextType | undefined>(undefined);

export function AMapProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<any | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Check if AMap is available globally
    const checkAMap = () => {
      if (typeof window !== 'undefined' && (window as any).AMap) {
        setIsLoaded(true);
      } else {
        // Retry after a short delay
        setTimeout(checkAMap, 100);
      }
    };

    checkAMap();
  }, []);

  return (
    <AMapContext.Provider value={{ map, setMap, isLoaded }}>
      {children}
    </AMapContext.Provider>
  );
}

export function useAMap() {
  const context = useContext(AMapContext);
  if (context === undefined) {
    throw new Error('useAMap must be used within an AMapProvider');
  }
  return context;
}