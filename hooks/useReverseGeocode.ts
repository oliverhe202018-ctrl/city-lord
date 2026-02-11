
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
    // Guard clause for invalid coordinates
    if (!map || !options || typeof window === 'undefined' || !(window as any).AMap) return;
    if (options.latitude === 0 && options.longitude === 0) return;

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
        } else if (status === 'no_data') {
          // Handle 'no_data' gracefully: it's not a system error, just no address found (e.g. ocean)
          // Do NOT set error state to avoid triggering error boundaries or logs
          setState({ loading: false, error: null, address: null });
        } else {
          console.error('[ReverseGeocode] Failed:', status, result);
          setState({ loading: false, error: result || 'Reverse geocode failed', address: null });
        }
      });
    });
  }, [map, options, setRegion]);

  useEffect(() => {
    if (!options) return;
    if (options.latitude === 0 && options.longitude === 0) return;
    getAddress();
  }, [options, getAddress]);

  return { ...state, refetch: getAddress };
};
