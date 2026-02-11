import { v4 as uuidv4 } from 'uuid';

/**
 * 前端 API 请求工具类
 * 自动处理幂等性 Key 的生成和注入
 */

// 扩展 RequestInit 类型以包含自定义选项
interface ExtendedRequestInit extends RequestInit {
  idempotent?: boolean; // 是否启用幂等性
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * 发起请求
   * @param url 请求地址
   * @param options 请求配置
   */
  async request<T>(url: string, options: ExtendedRequestInit = {}): Promise<T> {
    const { idempotent = false, headers: customHeaders, ...restOptions } = options;
    
    const headers = new Headers(customHeaders);
    
    // 默认 Content-Type
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    // 如果是 POST/PUT/PATCH 且开启了幂等性，注入 X-Idempotency-Key
    const method = (options.method || 'GET').toUpperCase();
    const isMutation = ['POST', 'PUT', 'PATCH'].includes(method);
    
    if (isMutation && idempotent) {
      // 生成 UUID v4 作为幂等性 Key
      // 注意：这里简单地为每次请求生成新 Key
      // 如果是重试场景（Retry），业务层应该传入同一个 Key，或者在这里实现重试逻辑
      // 这里的实现假设调用方如果想重试，会复用 options 对象。
      // 但为了确保自动重试（如网络错误）能复用 Key，更健壮的做法是在这里检查 options 中是否已有 Key
      
      let idempotencyKey = headers.get('X-Idempotency-Key');
      if (!idempotencyKey) {
        idempotencyKey = uuidv4();
        headers.set('X-Idempotency-Key', idempotencyKey);
      }
    }

    const response = await fetch(`${this.baseUrl}${url}`, {
      ...restOptions,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      // Handle 401 Unauthorized
      if (response.status === 401) {
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        throw new Error('Unauthorized');
      }

      // 处理 409 Conflict (并发/处理中)
      if (response.status === 409) {
        throw new Error('请求正在处理中，请勿重复提交');
      }
      
      // 其他错误
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Request failed with status ${response.status}`);
    }

    return response.json();
  }

  // 便捷方法
  get<T>(url: string, options?: Omit<ExtendedRequestInit, 'method'>) {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  post<T>(url: string, body: any, options?: Omit<ExtendedRequestInit, 'method' | 'body'>) {
    return this.request<T>(url, { 
      ...options, 
      method: 'POST', 
      body: JSON.stringify(body),
      idempotent: true // 默认 POST 开启幂等性
    });
  }

  put<T>(url: string, body: any, options?: Omit<ExtendedRequestInit, 'method' | 'body'>) {
    return this.request<T>(url, { 
      ...options, 
      method: 'PUT', 
      body: JSON.stringify(body),
      idempotent: true 
    });
  }
}

export const apiClient = new ApiClient();
