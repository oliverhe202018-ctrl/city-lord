import { Preferences } from '@capacitor/preferences';
import { createClient } from '@/lib/supabase/client';

const BASE_URL = process.env.NEXT_PUBLIC_API_SERVER || 'https://cl1.6543666.xyz';

let getTokenGetter: () => string | null = () => null;
let setTokenSetter: (token: string) => void = () => {};

/**
 * Dependency injection from the Zustand store to avoid circular imports
 */
export function injectStoreDependencies(
  getToken: () => string | null,
  setToken: (token: string) => void
) {
  getTokenGetter = getToken;
  setTokenSetter = setToken;
}

/**
 * Ensures a URL is absolute by prefixing BASE_URL if it starts with /
 */
export function getAbsoluteUrl(url: string): string {
  if (url.startsWith('/')) {
    return `${BASE_URL}${url}`;
  }
  return url;
}

interface CustomRequestInit extends RequestInit {
  skipAuthEvent?: boolean;
}

/**
 * Standard fetch replacement that handles absolute URLs and credentials.
 * It uses native fetch, which CapacitorHttp will intercept.
 */
export async function apiFetch(input: RequestInfo | URL, init?: CustomRequestInit): Promise<Response> {
  let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  
  url = getAbsoluteUrl(url);

  // Re-construct the input if it was a Request object, but usually it's a string
  const customInit: RequestInit = {
    ...init,
    // Omit credentials since we use Bearer tokens to avoid CORS preflight issues
    credentials: 'omit',
  };

  // 1. Try to get token synchronously from memory store first
  let token = getTokenGetter();
  
  // 2. Fallback to async Preferences check if store is empty
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
  let response = await fetch(url, customInit);

  // Global 401 handling & Silent Refresh
  if (response.status === 401 && !init?.skipAuthEvent && token) {
    const prefRefresh = await Preferences.get({ key: 'refreshToken' });
    const refreshToken = prefRefresh.value;
    
    if (refreshToken) {
      console.log('Attempting silent refresh...');
      const supabase = createClient();
      const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
      
      if (!error && data.session) {
        console.log('Silent refresh successful!');
        await Preferences.set({ key: 'authToken', value: data.session.access_token });
        await Preferences.set({ key: 'refreshToken', value: data.session.refresh_token });
        setTokenSetter(data.session.access_token);
        
        // Replay the request with new token
        customInit.headers = {
          ...customInit.headers,
          'Authorization': `Bearer ${data.session.access_token}`
        };
        response = await fetch(url, customInit);
        
        // If the replayed request succeeds, return it
        if (response.status !== 401) {
          return response;
        }
      }
    }

    console.warn('API returned 401 Unauthorized. Dispatching logout event.');
    window.dispatchEvent(new CustomEvent('auth:logout'));
    
    // Throw custom error so SWR won't show flash error UI
    const err: any = new Error('UNAUTHORIZED');
    err.isAuthError = true;
    throw err;
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
    // Suppress auth error logs
    if (!error.isAuthError) {
      console.error('Fetch shim error:', error);
    }
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
