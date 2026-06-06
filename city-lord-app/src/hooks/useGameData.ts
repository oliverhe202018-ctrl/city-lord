'use client'
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '@/lib/fetch-shim'
import useSWR from 'swr'
import { useGameStore } from '@/store/useGameStore'

function useAuthorizedFetcher() {
  const navigate = useNavigate()
  return useCallback(async (url: string) => {
    let r: Response;
    
    // ✅ 关键修复：try...catch 包裹网络请求，DNS 或离线报错直接返回 null
    try {
      r = await apiFetch(url, { credentials: 'include' });
    } catch (networkErr) {
      console.warn('[Fetcher] Network error for', url, networkErr);
      return null;
    }

    // ✅ 关键修复：r.status === 401 时保留跳转逻辑并 throw new Error('Unauthorized')
    if (r.status === 401) {
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    // ✅ 关键修复：!r.ok 时，打印 warn 并返回 null（不向上抛出异常）
    if (!r.ok) {
      console.warn(`[Fetcher] Non-OK response: ${r.status} for ${url}`);
      return null;
    }

    // ✅ 关键修复：检查 content-type 头，如果不包含 application/json，打印 warn 并返回 null
    const contentType = r.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      console.warn(`[Fetcher] Unexpected content-type "${contentType}" for ${url}`);
      return null;
    }

    // ✅ 关键修复：最后用 try...catch 包裹 await r.json()，解析失败返回 null
    try {
      return await r.json();
    } catch (parseErr) {
      console.warn('[Fetcher] JSON parse error for', url, parseErr);
      return null;
    }
  }, [navigate]);
}

// Hook 1: Faction Stats
export function useFactionStats() {
  const fetcher = useAuthorizedFetcher()
  return useSWR('/api/faction/stats', fetcher, {
    revalidateOnFocus: false, // Homepage doesn't need frequent updates
    dedupingInterval: 60000,   // 1 minute deduping
    onError: (err) => {
      // ✅ 静默捕获，防止 SWR 的 onError 向上抛出
      console.warn('[useFactionStats] SWR error (suppressed):', err);
    },
  })
}

// Hook 2: User Badges (Medal Wall)
export function useUserBadges() {
  const fetcher = useAuthorizedFetcher()
  return useSWR('/api/user/badges', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300000, // 5 minutes deduping, badges don't change often
    onError: (err) => {
      console.warn('[useUserBadges] SWR error (suppressed):', err);
    },
  })
}

// Hook 3: User Missions
export function useUserMissions() {
  const fetcher = useAuthorizedFetcher()
  return useSWR('/api/missions', fetcher, {
    revalidateOnFocus: true, // Mission status might change
    dedupingInterval: 10000, // 10 seconds deduping
    onError: (err) => {
      console.warn('[useUserMissions] SWR error (suppressed):', err);
    },
  })
}

// Hook 4: User Room Data (Legacy - fetches "current" room from DB perspective)
export function useMyRoomData() {
  const fetcher = useAuthorizedFetcher()
  return useSWR('/api/user/room', fetcher, { 
    revalidateOnFocus: false, 
    dedupingInterval: 300000, 
    onError: (err) => {
      console.warn('[useMyRoomData] SWR error (suppressed):', err);
    },
  })
}

// Hook 6: Specific Room Details (For UI selection)
export function useRoomDetails(roomId?: string) {
  const fetcher = useAuthorizedFetcher()
  return useSWR(roomId ? `/api/room/${roomId}` : null, fetcher, {
    revalidateOnFocus: true, // Need live participants updates
    dedupingInterval: 5000,  // Short cache for active room
    refreshInterval: 10000,   // Auto-refresh every 10s
    onError: (err) => {
      console.warn('[useRoomDetails] SWR error (suppressed):', err);
    },
  })
}

// Hook 5: Club Data
export function useClubData() {
  const userId = useGameStore((state) => state.userId)
  const fetcher = useAuthorizedFetcher()
  
  return useSWR(userId ? '/api/club/info' : null, fetcher, { 
    revalidateOnFocus: true,  // Club messages/members might update
    dedupingInterval: 60000,  // 1 minute cache
    onError: (err) => {
      console.warn('[useClubData] SWR error (suppressed):', err);
    },
  })
}
