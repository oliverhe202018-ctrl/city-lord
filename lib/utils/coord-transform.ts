import gcoord from 'gcoord';

export interface Coordinate {
    lng: number;
    lat: number;
}

/**
 * Transforms standard WGS84 GPS coordinates to GCJ02 (Mars coordinates) 
 * used by AMap (Gaode), Tencent Maps, etc. in China.
 * 
 * Safely falls back to the original coordinates if transformation fails.
 * 
 * @param lng Longitude in WGS84
 * @param lat Latitude in WGS84
 * @returns Object containing GCJ02 lng and lat
 */
export function wgs84ToGcj02(lng: number, lat: number): Coordinate {
    try {
        const result = gcoord.transform([lng, lat], gcoord.WGS84, gcoord.GCJ02);
        return {
            lng: result[0],
            lat: result[1]
        };
    } catch (error) {
        console.error('[coord-transform] gcoord transform failed, returning original coordinates:', error);
        return { lng, lat };
    }
}
