"use client"

import React, { forwardRef } from 'react';
import AMapView from './AMapView';
import { MapRoot } from './MapRoot';
import type { AMapViewHandle, AMapViewProps } from './AMapView';

// ✅ 使用 forwardRef 正确处理 ref
export const AMapViewWithProvider = forwardRef<AMapViewHandle, AMapViewProps>(
  function AMapViewWithProvider(props, ref) {
    return (
      <MapRoot>
        <AMapView {...props} ref={ref} />
      </MapRoot>
    );
  }
);

// ✅ 添加 displayName（用于调试）
AMapViewWithProvider.displayName = 'AMapViewWithProvider';
