import { Preferences } from '@capacitor/preferences';
import { createClient } from '@/lib/supabase/client';
import { keysToSnake, keysToCamel } from './case-converter';

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

  // [请求拦截器]：将前端发送的 JSON Payload 从 camelCase 转换为 snake_case
  if (customInit.body && typeof customInit.body === 'string') {
    try {
      const parsedBody = JSON.parse(customInit.body);
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

  // Global 401 handling
  if (response.status === 401 && !init?.skipAuthEvent && token) {
    // If the server returns 401 despite having a token, the session is invalid
    console.warn('API returned 401 Unauthorized. Dispatching logout event.');
    await supabase.auth.signOut();
    window.dispatchEvent(new CustomEvent('auth:logout'));
    const err: any = new Error('UNAUTHORIZED');
    err.isAuthError = true;
    throw err;
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
