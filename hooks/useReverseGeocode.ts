
"use client";

import { useState, useCallback, useEffect } from 'react';
import { useAMap } from '@/components/map/AMapProvider';
import { useRegion } from '@/contexts/RegionContext';

interface ReverseGeocodeOptions {
  latitude: number;
  longitude: number;
}

interface ReverseGeocodeState {
  loading: boolean;
  error: any;
  address: any | null;
}

/**
 * Normalizes the address component from AMap's reverse geocoding response.
 * For municipalities like Beijing, the 'city' field might be empty, so we use the 'province' field instead.
 * 
 * @param addressComponent The address component from AMap Geocoder
 * @returns A normalized address component
 */
const normalizeAddressComponent = (addressComponent: any) => {
  const { city, province } = addressComponent;
  if (!city || (Array.isArray(city) && city.length === 0)) {
    return { ...addressComponent, city: province };
  }
  return addressComponent;
};

/**
 * Hook to perform reverse geocoding using AMap.
 * It also normalizes the address for municipalities.
 * 
 * @param options Latitude and longitude
 */
export const useReverseGeocode = (options: ReverseGeocodeOptions | null) => {
  const { map } = useAMap();
  const { setRegion } = useRegion();
  const [state, setState] = useState<ReverseGeocodeState>({
    loading: false,
    error: null,
    address: null,
  });

  const getAddress = useCallback(async () => {
    if (!map || !options || typeof window === 'undefined' || !(window as any).AMap) return;

    setState({ loading: true, error: null, address: null });

    const AMap = (window as any).AMap;
    
    AMap.plugin('AMap.Geocoder', function() {
      const geocoder = new AMap.Geocoder();
      const lngLat: [number, number] = [options.longitude, options.latitude];

      geocoder.getAddress(lngLat, (status: string, result: any) => {
        if (status === 'complete' && result.regeocode) {
          const normalizedAddress = normalizeAddressComponent(result.regeocode.addressComponent);
          const fullResult = { ...result.regeocode, addressComponent: normalizedAddress };

          setState({ loading: false, error: null, address: fullResult });

          // Update the global region store
          setRegion({
            regionType: 'county', // Default to county level
            cityName: normalizedAddress.city,
            countyName: normalizedAddress.district,
            province: normalizedAddress.province,
            adcode: normalizedAddress.adcode,
            centerLngLat: lngLat, // Current location
            lastFixCenter: lngLat, // Save as last fix
          });
        } else {
          setState({ loading: false, error: 'Reverse geocode failed', address: null });
        }
      });
    });
  }, [map, options, setRegion]);

  useEffect(() => {
    if (options?.latitude && options?.longitude) {
      getAddress();
    }
  }, [options, getAddress]);

  return { ...state, refetch: getAddress };
};
