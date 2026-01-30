"use client"

import React from 'react';
import dynamic from 'next/dynamic';
import { AMapProvider } from './AMapProvider';
import type { AMapViewHandle, AMapViewProps } from './AMapView';

const AMapView = dynamic(() => import('./AMapView'), {
  ssr: false,
});

export function AMapViewWithProvider(props: AMapViewProps & { ref?: React.Ref<AMapViewHandle> }) {
  return (
    <AMapProvider>
      <AMapView {...props} />
    </AMapProvider>
  );
}