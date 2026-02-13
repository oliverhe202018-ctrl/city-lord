"use client"

import React from 'react';
import dynamic from 'next/dynamic';
import { MapRoot } from './MapRoot';
import type { AMapViewHandle, AMapViewProps } from './AMapView';

const AMapView = dynamic(() => import('./AMapView'), {
  ssr: false,
});

export function AMapViewWithProvider(props: AMapViewProps & { ref?: React.Ref<AMapViewHandle> }) {
  return (
    <MapRoot>
      <AMapView {...props} />
    </MapRoot>
  );
}