'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import type { HomeSummaryData } from '@/types/home';

/**
 * Aggregated SWR hook for the Game Home page.
 * Single request that returns all homepage sections.
 */
export function useHomeData(scope: string = 'nearby') {
    const router = useRouter()
    const fetcher = useCallback((url: string) =>
        fetch(url, { credentials: 'include' }).then((r) => {
            if (r.status === 401) {
                router.replace('/login')
                router.refresh()
                throw new Error('Unauthorized');
            }
            return r.json();
        }), [router]);
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
