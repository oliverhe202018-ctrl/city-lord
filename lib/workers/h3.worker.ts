// Using importScripts or standard import if bundler supports it.
// Next.js with App Router usually handles imports in workers if configured correctly,
// but for maximum compatibility with 'h3-js', standard import is preferred.
import { polygonToCells, latLngToCell } from "h3-js";

// Define Message Types
export type H3WorkerRequest = {
  id: string; // Request ID to match response
  type: 'POLYGON_TO_CELLS';
  payload: {
    coordinates: number[][]; // [lat, lng][] or [lng, lat][] depending on H3 expectation? H3 expects [lat, lng] usually for polygonToCells? 
    // Wait, h3-js polygonToCells expects [[lat, lng], [lat, lng]...]
    resolution: number;
  };
} | {
    id: string;
    type: 'LAT_LNG_TO_CELL';
    payload: {
        lat: number;
        lng: number;
        resolution: number;
    }
};

export type H3WorkerResponse = {
  id: string;
  success: boolean;
  data?: string[]; // Array of H3 indexes
  cell?: string; // Single H3 index
  error?: string;
};

// Global scope for worker
const ctx: Worker = self as any;

ctx.onmessage = (event: MessageEvent<H3WorkerRequest>) => {
  const { id, type, payload } = event.data;

  try {
    if (type === 'POLYGON_TO_CELLS') {
      const { coordinates, resolution } = payload;
      
      // h3-js polygonToCells input: Array of loops, where each loop is an array of [lat, lng] pairs
      // We assume payload.coordinates is a single loop: [[lat, lng], [lat, lng]...]
      const cells = polygonToCells(coordinates, resolution, true);
      
      const response: H3WorkerResponse = {
        id,
        success: true,
        data: cells,
      };
      ctx.postMessage(response);
    } 
    else if (type === 'LAT_LNG_TO_CELL') {
        const { lat, lng, resolution } = payload;
        const cell = latLngToCell(lat, lng, resolution);
        const response: H3WorkerResponse = {
            id,
            success: true,
            cell: cell
        };
        ctx.postMessage(response);
    }
    else {
      throw new Error(`Unknown message type: ${(event.data as any).type}`);
    }
  } catch (error: any) {
    const response: H3WorkerResponse = {
      id,
      success: false,
      error: error.message || 'Unknown worker error',
    };
    ctx.postMessage(response);
  }
};
