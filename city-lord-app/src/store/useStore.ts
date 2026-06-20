import { create } from 'zustand';
import { Capacitor } from '@capacitor/core';
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

const getSupabaseProjectRef = (url: string): string => {
  if (!url) return '';
  try {
    const cleanUrl = url.replace(/^https?:\/\//, '');
    const parts = cleanUrl.split('.');
    if (parts.length > 0) {
      return parts[0];
    }
  } catch (_) {}
  return '';
};

// [P0 Fix] 移除同步读取 window.localStorage 的操作，防止 WebView 初始化竞态导致 Crash
// 初始状态强制为 hydrating，由 checkAuth 异步完成认证校验
const initialAuth = {
  isHydrating: true,
  isAuthenticated: false,
  userId: null,
  token: null,
};

export const useStore = create<UserState>((set) => ({
  isHydrating: initialAuth.isHydrating,
  isAuthenticated: initialAuth.isAuthenticated,
  userId: initialAuth.userId,
  token: initialAuth.token,
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
      await Preferences.set({ key: 'userId', value: userId });
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('userId', userId);
      }
      
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
      await Preferences.set({ key: 'userId', value: userId });
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('userId', userId);
      }

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
    await Preferences.remove({ key: 'userId' });
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('userId');
    }
    // Also remove old keys just in case
    await Preferences.remove({ key: 'authToken' });
    await Preferences.remove({ key: 'refreshToken' });
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
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const projectRef = getSupabaseProjectRef(supabaseUrl);

      const sbKeys: string[] = [];
      if (projectRef) sbKeys.push(`sb-${projectRef}-auth-token`);
      if (supabaseUrl) sbKeys.push(`sb-${supabaseUrl}-auth-token`);
      
      // 1. Try to read from fast sync localStorage first, then async Preferences
      let sbSessionStr = null;
      if (typeof window !== 'undefined') {
        for (const key of sbKeys) {
          const val = window.localStorage.getItem(key);
          if (val) {
            sbSessionStr = val;
            break;
          }
        }
      }

      if (!sbSessionStr) {
        for (const key of sbKeys) {
          const { value } = await Preferences.get({ key });
          if (value) {
            sbSessionStr = value;
            if (typeof window !== 'undefined') {
              window.localStorage.setItem(key, sbSessionStr);
            }
            break;
          }
        }
      }
      
      let cachedUserId = null;
      if (typeof window !== 'undefined') {
        cachedUserId = window.localStorage.getItem('userId');
      }
      if (!cachedUserId) {
        const { value } = await Preferences.get({ key: 'userId' });
        cachedUserId = value;
        if (cachedUserId && typeof window !== 'undefined') {
          window.localStorage.setItem('userId', cachedUserId);
        }
      }

      let token: string | null = null;
      if (sbSessionStr) {
        try {
          const parsed = JSON.parse(sbSessionStr);
          token = parsed?.currentSession?.access_token || parsed?.access_token || null;
        } catch (_) {}
      }

      // If we have both token and userId cached, hydrate the app instantly!
      if (token && cachedUserId) {
        set({ 
          isAuthenticated: true, 
          token, 
          userId: cachedUserId,
          isHydrating: false 
        });

        // Verify and refresh session/profile in the background without blocking the UI
        (async () => {
          try {
            const supabase = createClient();
            const { data: { session: freshSession } } = await supabase.auth.getSession();
            const freshToken = freshSession?.access_token;
            
            if (freshToken) {
              const res = await apiFetch('/api/v1/user/profile');
              if (res.ok) {
                const data = await res.json();
                if (data.success && data.data) {
                  set({ 
                    isAuthenticated: true,
                    token: freshToken, 
                    userId: cachedUserId || data.data.id,
                    profile: data.data 
                  });
                  return;
                }
              }
            }
          } catch (e: any) {
            console.warn('Silent background auth check failed:', e);
            // [P0 Fix] 宽容的 Resume 检查：区分网络/唤醒延迟与真正的 Auth 失效
            const isNetworkError = e?.name === 'AbortError' ||
              e?.message?.includes('network') ||
              e?.message?.includes('Failed to fetch') ||
              e?.message?.includes('Load failed') ||
              e?.status === 0;
            if (isNetworkError) {
              // 网络错误（App 刚恢复前台）：保持当前状态，不强制登出
              console.log('[checkAuth] Network/wake error during resume, keeping current state — not a real auth failure.');
              return;
            }
            // [P0 Fix] 权限请求期间也不执行登出
            const isRequesting = useGameStore.getState().isPermissionRequesting;
            if (isRequesting) {
              console.log('[checkAuth] Permission request in progress, deferring logout decision.');
              return;
            }
            if (e?.isAuthError || e?.status === 401) {
              // Only logout if it is explicitly an auth validation failure
              useStore.getState().logout();
            }
          }
        })();
        return;
      }
    } catch (e) {
      console.warn('Optimistic auth cache check failed:', e);
    }

    // Fallback: if no cached credentials, run the standard check once and clear hydration
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const { value: userId } = await Preferences.get({ key: 'userId' });

      if (token) {
        set({ 
          isAuthenticated: true, 
          token, 
          userId: userId || session?.user?.id || null,
          isHydrating: false
        });

        // Non-blocking background fetch for user profile
        (async () => {
          try {
            const res = await apiFetch('/api/v1/user/profile');
            if (res.ok) {
              const data = await res.json();
              if (data.success && data.data) {
                set({ profile: data.data });
              }
            }
          } catch (err) {
            console.warn('Background profile fetch failed in checkAuth fallback:', err);
          }
        })();
        return;
      }
    } catch (e: any) {
      console.warn('Standard auth check failed:', e);
      if (e?.isAuthError) {
        set({ isAuthenticated: false, userId: null, token: null, profile: null, isHydrating: false });
        return;
      }
      // If network error, let them keep whatever cached state if token exists
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const { value: userId } = await Preferences.get({ key: 'userId' });
      if (token) {
        set({ isAuthenticated: true, token, userId: userId || session?.user?.id || null, isHydrating: false });
        return;
      }
    }

    set({ isAuthenticated: false, userId: null, token: null, profile: null, isHydrating: false });
  }
}));
