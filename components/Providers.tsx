'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createIDBPersister } from '@/lib/query-persist'
import { useState, useEffect } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Cache data for 24 hours (Offline First)
        gcTime: 1000 * 60 * 60 * 24, 
        // Stale time 5 minutes (Background Refetch will happen after this)
        staleTime: 5 * 60 * 1000,
        // Retry failed requests once
        retry: 1,
        // Refetch on window focus
        refetchOnWindowFocus: true,
        // Refetch on reconnect (Crucial for Offline First)
        refetchOnReconnect: true,
      },
    },
  }))

  const [persister] = useState(() => {
    if (typeof window !== 'undefined') {
      return createIDBPersister()
    }
    return undefined
  })

  // Prevent hydration mismatch by rendering only after mount? 
  // Actually PersistQueryClientProvider handles this internally by loading async.
  // But we need to ensure the persister is available.
  
  if (!persister) {
    // Fallback for SSR or initial mount if window undefined (though useEffect handles it usually)
    // We must provide a QueryClientProvider even if persistence isn't ready yet,
    // otherwise child components using useQuery will crash.
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }

  return (
    <PersistQueryClientProvider 
      client={queryClient} 
      persistOptions={{ 
        persister, 
        maxAge: 1000 * 60 * 60 * 24 * 7, // Persist for 7 days
        dehydrateOptions: {
            shouldDehydrateQuery: (query) => {
                // Only persist successful queries
                return query.state.status === 'success'
            }
        }
      }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}
