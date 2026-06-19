import { Preferences } from '@capacitor/preferences';
import { createClient } from '@/lib/supabase/client';
import { keysToSnake, keysToCamel } from './case-converter';

const BASE_URL = process.env.NEXT_PUBLIC_API_SERVER || 'https://cl1.6543666.xyz';

let getTokenGetter: () => string | null = () => null;
let setTokenSetter: (token: string) => void = () => {};

// [P6] 全局刷新锁 — 阻断并发 401 触发的 Token 刷新风暴
let refreshPromise: Promise<string | null> | null = null;

async function refreshSessionOnce(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const supabase = createClient();
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshData?.session && !refreshError) {
        const newToken = refreshData.session.access_token;
        setTokenSetter(newToken);
        return newToken;
      }
      // Refresh failed — hard logout
      await supabase.auth.signOut();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:logout'));
      }
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

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

  // [请求拦截器]：仅在 JSON 请求时将前端发送的 JSON Payload 从 camelCase 转换为 snake_case
  let isJsonRequest = false;
  if (customInit.body && typeof customInit.body === 'string') {
    const headers = (customInit.headers || {}) as Record<string, string>;
    const contentTypeKey = Object.keys(headers).find(k => k.toLowerCase() === 'content-type');
    const contentType = contentTypeKey ? headers[contentTypeKey] : undefined;
    isJsonRequest = !contentType || contentType.toLowerCase().includes('application/json');
  }

  if (isJsonRequest) {
    try {
      const parsedBody = JSON.parse(customInit.body as string);
      const snakedBody = keysToSnake(parsedBody);
      customInit.body = JSON.stringify(snakedBody);
    } catch (e) {
      // 解析失败说明不是 JSON 字符串，保持原样放行
    }
  }

  // Let Supabase client automatically manage token refresh
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  let token = session?.access_token;

  if (token) {
    customInit.headers = {
      ...customInit.headers,
      'Authorization': `Bearer ${token}`
    };
  }

  // CapacitorHttp automatically bridges fetch requests on native apps
  let response = await fetch(url, customInit);

  // [P6] Global 401 handling — 使用刷新锁避免风暴
  if (response.status === 401 && !init?.skipAuthEvent && token) {
    const newToken = await refreshSessionOnce();
    if (newToken) {
      const retryInit: CustomRequestInit = {
        ...customInit,
        skipAuthEvent: true,
        headers: {
          ...customInit.headers,
          'Authorization': `Bearer ${newToken}`
        }
      };
      return fetch(url, retryInit);
    }
    const err: any = new Error('UNAUTHORIZED');
    err.isAuthError = true;
    throw err;
  }

  // Global 403 handling (Capacitor drops response body defense)
  if (response.status === 403) {
    let errorBody: any = null;
    try {
      errorBody = await response.clone().json();
    } catch {
      // Body was dropped by WebView/Capacitor
    }
    if (!errorBody) {
      // Reconstruct a valid JSON response body
      const mockBody = {
        success: false,
        error: {
          code: 'CHEAT_BLOCKED',
          message: 'Request blocked by security policy.'
        }
      };
      response = new Response(JSON.stringify(mockBody), {
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers({
          'content-type': 'application/json'
        })
      });
    }
  }

  // [响应拦截器]：对 JSON 响应进行深度驼峰转换，避免破坏流与二进制响应
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      const data = await response.clone().json();
      const camelData = keysToCamel(data);
      return new Response(JSON.stringify(camelData), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    } catch (e) {
      // 解析或转换失败时回退返回原始 Response
      console.warn('apiFetch JSON parsing failed, falling back to raw response', e);
    }
  }

  // 非 JSON 响应（如 Blob, FormData, Stream）直接原样返回，不做任何拦截
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
