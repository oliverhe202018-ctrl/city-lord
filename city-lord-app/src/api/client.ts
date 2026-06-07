import axios from 'axios';
import { useStore } from '../store/useStore';
import { Preferences } from '@capacitor/preferences';

// Determine base URL based on environment
// For production Capacitor apps, this points to the live server
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://cl1.6543666.xyz';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  withCredentials: true,
});

// Request interceptor to attach JWT
apiClient.interceptors.request.use(
  async (config) => {
    // We can pull the token from Zustand store
    let token = useStore.getState().token;
    if (!token) {
      try {
        const { value } = await Preferences.get({ key: 'authToken' });
        token = value;
      } catch (e) {
        // Ignore preferences errors
      }
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const { isAuthenticated } = useStore.getState();
      if (isAuthenticated) {
        useStore.getState().logout();
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Generic RPC caller that bridges Native Vite to Next.js Server Actions
 */
export async function rpcCall<T = any>(module: string, action: string, args: any[] = []): Promise<T> {
  const response = await apiClient.post('/api/v1/rpc', {
    module,
    action,
    args
  });
  
  const data = response.data;
  if (!data.success) {
    throw new Error(data.error || 'RPC call failed');
  }
  
  return data.data as T;
}
