import { create } from 'zustand';
import { Preferences } from '@capacitor/preferences';
import { apiFetch } from '@/lib/fetch-shim';
import { createClient } from '@/lib/supabase/client';

interface UserState {
  isHydrating: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  token: string | null;
  profile: any | null;
  unreadMessageCount: number;
  unreadNotificationCount: number;
  
  // New auth actions
  sendCode: (account: string, type: 'login' | 'register') => Promise<void>;
  loginWithCode: (account: string, code: string, type: 'login' | 'register') => Promise<void>;
  loginWithPassword: (account: string, password: string) => Promise<void>;
  
  logout: () => Promise<void>;
  setProfile: (profile: any) => void;
  setUnreadCounts: (msg: number, notif: number) => void;
  checkAuth: () => Promise<void>;
}

export const useStore = create<UserState>((set) => ({
  isHydrating: true,
  isAuthenticated: false,
  userId: null,
  token: null,
  profile: null,
  unreadMessageCount: 0,
  unreadNotificationCount: 0,

  sendCode: async (account: string, type: 'login' | 'register') => {
    const isEmail = account.includes('@');
    const body = isEmail ? { email: account, type } : { phone: account, type };
    
    const res = await apiFetch('/api/v1/auth/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || '发送失败');
    }
  },

  loginWithCode: async (account: string, code: string, type: 'login' | 'register') => {
    const isEmail = account.includes('@');
    const body = isEmail ? { email: account, code, type } : { phone: account, code, type };
    
    const res = await apiFetch('/api/v1/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || '验证失败');
    }

    if (data.data?.token) {
      const { token, refreshToken, userId } = data.data;
      await Preferences.set({ key: 'authToken', value: token });
      if (refreshToken) await Preferences.set({ key: 'refreshToken', value: refreshToken });
      await Preferences.set({ key: 'userId', value: userId });
      
      try {
        const supabase = createClient();
        await supabase.auth.setSession({
          access_token: token,
          refresh_token: refreshToken || '',
        });
      } catch (err) {
        console.warn('Failed to set Supabase session in loginWithCode:', err);
      }

      set({ isAuthenticated: true, token, userId });
      
      // Fetch profile data
      const store = useStore.getState();
      await store.checkAuth();
    }
  },

  loginWithPassword: async (account: string, password: string) => {
    const res = await apiFetch('/api/v1/auth/password-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account, password }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || '登录失败');
    }

    if (data.data?.token) {
      const { token, refreshToken, userId } = data.data;
      await Preferences.set({ key: 'authToken', value: token });
      if (refreshToken) await Preferences.set({ key: 'refreshToken', value: refreshToken });
      await Preferences.set({ key: 'userId', value: userId });

      try {
        const supabase = createClient();
        await supabase.auth.setSession({
          access_token: token,
          refresh_token: refreshToken || '',
        });
      } catch (err) {
        console.warn('Failed to set Supabase session in loginWithPassword:', err);
      }

      set({ isAuthenticated: true, token, userId });
      
      // Fetch profile data
      const store = useStore.getState();
      await store.checkAuth();
    }
  },

  logout: async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Failed to sign out from Supabase in logout:', err);
    }
    await Preferences.remove({ key: 'authToken' });
    await Preferences.remove({ key: 'refreshToken' });
    await Preferences.remove({ key: 'userId' });
    set({ isAuthenticated: false, userId: null, token: null, profile: null });
  },

  setProfile: (profile) => {
    set({ profile });
  },

  setUnreadCounts: (msg, notif) => {
    set({ unreadMessageCount: msg, unreadNotificationCount: notif });
  },

  checkAuth: async () => {
    try {
      const { value: token } = await Preferences.get({ key: 'authToken' });
      const { value: userId } = await Preferences.get({ key: 'userId' });

      if (token) {
        // Verify with backend
        const res = await apiFetch('/api/v1/user/profile', { skipAuthEvent: true });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            const { value: refreshToken } = await Preferences.get({ key: 'refreshToken' });
            try {
              const supabase = createClient();
              await supabase.auth.setSession({
                access_token: token,
                refresh_token: refreshToken || '',
              });
            } catch (err) {
              console.warn('Failed to set Supabase session in checkAuth:', err);
            }

            set({ 
              isAuthenticated: true, 
              token, 
              userId: userId || data.data.id,
              profile: data.data,
              isHydrating: false
            });
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Silent auth check failed:', e);
    }
    
    // Clear invalid session
    set({ isAuthenticated: false, userId: null, token: null, profile: null, isHydrating: false });
  }
}));
