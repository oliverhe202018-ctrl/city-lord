import axios from 'axios';
import { Preferences } from '@capacitor/preferences';

declare global {
  interface Window {
    Capacitor: any;
  }
}

// Use production VPS URL for the real phone APK testing
const API_BASE_URL = 'https://cl1.4567666.xyz/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

api.interceptors.request.use(
  async (config) => {
    // Determine dynamic base URL based on environment
    // For local dev in browser, we can use http://localhost:3000
    // For production, we would use https://cl1.4567666.xyz
    const { value: customUrl } = await Preferences.get({ key: 'apiBaseUrl' });
    if (customUrl) {
      config.baseURL = customUrl;
    } else if (import.meta.env.DEV && !window.Capacitor?.isNativePlatform()) {
      config.baseURL = 'http://localhost:3000/api/v1';
    }

    const { value: token } = await Preferences.get({ key: 'authToken' });
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
