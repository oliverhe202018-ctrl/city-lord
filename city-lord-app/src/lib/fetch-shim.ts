import { Preferences } from '@capacitor/preferences';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://cl1.4567666.xyz';

import { useStore } from '@/store/useStore';

/**
 * Ensures a URL is absolute by prefixing BASE_URL if it starts with /
 */
export function getAbsoluteUrl(url: string): string {
  if (url.startsWith('/')) {
    return `${BASE_URL}${url}`;
  }
  return url;
}

/**
 * Standard fetch replacement that handles absolute URLs and credentials.
 * It uses native fetch, which CapacitorHttp will intercept.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  
  url = getAbsoluteUrl(url);

  // Re-construct the input if it was a Request object, but usually it's a string
  const customInit: RequestInit = {
    ...init,
    // Omit credentials since we use Bearer tokens to avoid CORS preflight issues
    credentials: 'omit',
  };

  // 1. Try to get token synchronously from memory store first
  let token = useStore.getState().token;
  
  // 2. Fallback to async Preferences check if store is empty (e.g., during hydration or direct fetch call)
  if (!token) {
    const pref = await Preferences.get({ key: 'authToken' });
    token = pref.value;
  }

  if (token) {
    customInit.headers = {
      ...customInit.headers,
      'Authorization': `Bearer ${token}`
    };
  }

  // CapacitorHttp automatically bridges fetch requests on native apps
  const response = await fetch(url, customInit);

  // Global 401 handling
  if (response.status === 401) {
    console.warn('API returned 401 Unauthorized. Dispatching logout event.');
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }

  return response;
}

/**
 * Global SWR fetcher
 */
export const swrFetcher = async (url: string) => {
  const res = await apiFetch(url);
  
  // If the status code is not in the range 200-299,
  // we still try to parse and throw it.
  if (!res.ok) {
    let errorInfo;
    try {
      errorInfo = await res.json();
    } catch (e) {
      errorInfo = { message: res.statusText };
    }
    const error: any = new Error(errorInfo.message || 'An error occurred while fetching the data.');
    error.info = errorInfo;
    error.status = res.status;
    throw error;
  }

  return res.json();
};

/**
 * Legacy shim for older code
 */
export async function fetchWithTimeout(url: string, options: any = {}) {
  try {
    const response = await apiFetch(url, options);
    return {
      ok: response.ok,
      json: async () => response.json(),
      status: response.status
    };
  } catch (error: any) {
    console.error('Fetch shim error:', error);
    return {
      ok: false,
      json: async () => ({ success: false, error: error.message }),
      status: 500
    };
  }
}

export const customFetch = async (url: string, options: any = {}) => {
  return fetchWithTimeout(url, options);
};
