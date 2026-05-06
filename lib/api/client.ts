import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';

// ─── Capacitor 环境检测 ──────────────────────────────────────────────────────
const isCapacitor = 
  typeof window !== 'undefined' && !!(window as any).Capacitor;

// Capacitor 环境下必须使用绝对路径，Web 端保持相对路径即可
const API_BASE = isCapacitor 
  ? (process.env.NEXT_PUBLIC_API_BASE_URL ?? '') 
  : '';

interface ExtendedRequestInit extends RequestInit {
  idempotent?: boolean;
  /** 设为 true 可跳过全局 Toast（如静默轮询） */
  silent?: boolean;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  async request<T = any>(url: string, options: ExtendedRequestInit = {}): Promise<T> {
    const { 
      idempotent = false, 
      silent = false, 
      headers: customHeaders, 
      ...restOptions 
    } = options;
    
    const headers = new Headers(customHeaders);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const method = (options.method || 'GET').toUpperCase();
    const isMutation = ['POST', 'PUT', 'PATCH'].includes(method);
    
    if (isMutation && idempotent) {
      if (!headers.has('X-Idempotency-Key')) {
        headers.set('X-Idempotency-Key', uuidv4());
      }
    }

    // ── 实际发出请求 ────────────────────────────────────────────────────────
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${url}`, {
        ...restOptions,
        headers,
        credentials: 'include',
      });
    } catch (networkError: any) {
      // fetch() 本身抛出（DNS 解析失败、网络断开、CORS preflight 被拒）
      const msg = isCapacitor
        ? `[网络错误] 无法连接服务器，请检查网络或 API 地址配置\n${networkError?.message ?? ''}`
        : `网络请求失败: ${networkError?.message ?? '未知错误'}`;
      if (!silent) toast.error(msg);
      throw networkError;
    }

    // ── HTTP 错误处理 ────────────────────────────────────────────────────────
    if (!response.ok) {
      // Handle 401 Unauthorized
      if (response.status === 401) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('citylord:navigate', { detail: { to: '/login', replace: true } })
          );
        }
        throw new Error('Unauthorized');
      }

      // 处理 409 Conflict (并发/处理中)
      if (response.status === 409) {
        const msg = '请求正在处理中，请勿重复提交';
        if (!silent) toast.error(msg);
        throw new Error(msg);
      }
      
      const errorData = await response.json().catch(() => ({}));
      const msg = errorData.message || `请求失败 (${response.status})`;
      if (!silent) toast.error(msg);
      throw new Error(msg);
    }

    return response.json() as Promise<T>;
  }

  get<T = any>(url: string, options?: Omit<ExtendedRequestInit, 'method'>) {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  post<T = any>(url: string, body: any, options?: Omit<ExtendedRequestInit, 'method' | 'body'>) {
    return this.request<T>(url, { 
      ...options, 
      method: 'POST', 
      body: JSON.stringify(body),
      idempotent: true 
    });
  }

  put<T = any>(url: string, body: any, options?: Omit<ExtendedRequestInit, 'method' | 'body'>) {
    return this.request<T>(url, { 
      ...options, 
      method: 'PUT', 
      body: JSON.stringify(body),
      idempotent: true 
    });
  }
}

export const apiClient = new ApiClient();
