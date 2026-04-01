"use client"

import React, { forwardRef } from 'react';
import AMapView from './AMapView';
import { MapRoot } from './MapRoot';
import type { AMapViewHandle, AMapViewProps } from './AMapView';
import { TerritoryInfoBar } from '@/components/citylord/territory/TerritoryInfoBar';
import { TerritoryDetailSheet } from '@/components/citylord/territory/TerritoryDetailSheet';

type AMapViewWithProviderProps = AMapViewProps & {
  children?: React.ReactNode;
};

export const AMapViewWithProvider = forwardRef<AMapViewHandle, AMapViewWithProviderProps>(
  function AMapViewWithProvider({ children, ...props }, ref) {
    return (
      <MapRoot>
        <AMapView {...props} ref={ref} />
        <TerritoryInfoBar />
        <TerritoryDetailSheet />
        {children}
      </MapRoot>
    );
  }
);

AMapViewWithProvider.displayName = 'AMapViewWithProvider';
