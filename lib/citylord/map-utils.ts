/**
 * [DEPRECATED] H3-js based map utils. 
 * This file is being cleared as part of the H3 legacy eradication.
 * Use polygon-based logic instead.
 */

export function h3ToAmapGeoJSON(h3Index: string, properties: any = {}) {
  console.warn('Deprecated: h3ToAmapGeoJSON called.');
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[]]
    },
    properties: {
      ...properties,
      id: h3Index,
    }
  };
}

export function h3SetToFeatureCollection(h3Indices: string[], getProperties?: (h3: string) => any) {
  return {
    type: 'FeatureCollection',
    features: []
  };
}