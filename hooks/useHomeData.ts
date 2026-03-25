'use client';

import useSWR from 'swr';
import type { HomeSummaryData } from '@/types/home';

const fetcher = (url: string) =>
    fetch(url, { credentials: 'include' }).then((r) => {
        if (r.status === 401) {
            if (typeof window !== 'undefined') window.location.href = '/login';
            throw new Error('Unauthorized');
        }
        return r.json();
    });

/**
 * Aggregated SWR hook for the Game Home page.
 * Single request that returns all homepage sections.
 */
export function useHomeData(scope: string = 'nearby') {
    const { data, error, isLoading, mutate } = useSWR<HomeSummaryData>(
        `/api/home/summary?scope=${scope}`,
        fetcher,
        {
            revalidateOnFocus: true,
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
