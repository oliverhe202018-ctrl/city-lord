"use client"

import React, { forwardRef } from 'react';
import AMapView from './AMapView';
import { MapRoot } from './MapRoot';
import type { AMapViewHandle, AMapViewProps } from './AMapView';
import { TerritoryInfoBar } from '@/components/citylord/territory/TerritoryInfoBar';
import { TerritoryDetailSheet } from '@/components/citylord/territory/TerritoryDetailSheet';

// ✅ 使用 forwardRef 正确处理 ref
export const AMapViewWithProvider = forwardRef<AMapViewHandle, AMapViewProps>(
  function AMapViewWithProvider(props, ref) {
    return (
      <MapRoot>
        <AMapView {...props} ref={ref} />
        {/* Territory Detail Interactions (Individual View) */}
        <TerritoryInfoBar />
        <TerritoryDetailSheet />
      </MapRoot>
    );
  }
);

// ✅ 添加 displayName（用于调试）
AMapViewWithProvider.displayName = 'AMapViewWithProvider';
