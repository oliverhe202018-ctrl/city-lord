'use client';

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '@/lib/fetch-shim';
import useSWR from 'swr';
import type { HomeSummaryData } from '@/types/home';

/**
 * Aggregated SWR hook for the Game Home page.
 * Single request that returns all homepage sections.
 */
export function useHomeData(scope: string = 'nearby') {
    const navigate = useNavigate()
    const cacheKey = `home_summary_cache_${scope}`

    const getCachedData = (): HomeSummaryData | undefined => {
        if (typeof window === 'undefined') return undefined;
        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) return JSON.parse(cached);
        } catch (_) {}
        return undefined;
    };

    const fetcher = useCallback((url: string) =>
        apiFetch(url, { credentials: 'include' }).then((r) => {
            if (r.status === 401) {
                window.location.href = '/login';
                throw new Error('Unauthorized');
            }
            return r.json().then((resData) => {
                if (resData && !resData.error && typeof window !== 'undefined') {
                    try {
                        localStorage.setItem(cacheKey, JSON.stringify(resData));
                    } catch (_) {}
                }
                return resData;
            });
        }), [navigate, cacheKey]);

    const { data, error, isLoading, mutate } = useSWR<HomeSummaryData>(
        `/api/home/summary?scope=${scope}`,
        fetcher,
        {
            fallbackData: getCachedData(),
            revalidateOnFocus: false,
            dedupingInterval: 30000,       // 30s dedup - avoid request storms
            errorRetryCount: 3,
            errorRetryInterval: 5000,
            keepPreviousData: true,        // Avoid layout shift on refetch
        }
    );

    return {
        data: data ?? null,
        error,
        isLoading,
        mutate,
    };
}

