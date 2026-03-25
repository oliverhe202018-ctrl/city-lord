"use client"

import { useEffect, useCallback, useRef, useState } from "react"
import { toast } from "sonner"
import { saveRunActivity } from "@/app/actions/run-service"
import { useGameStore } from "@/store/useGameStore"

const PENDING_KEY = 'PENDING_RUN_UPLOAD'

export function SyncManager() {
  const userId = useGameStore(state => state.userId)
  const isSyncingRef = useRef(false)
  const [pendingCount, setPendingCount] = useState(0)

  const syncPendingRuns = useCallback(async () => {
    if (!userId || isSyncingRef.current) return

    const pendingStr = localStorage.getItem(PENDING_KEY)
    if (!pendingStr) {
      setPendingCount(0)
      return
    }

    let pendingRuns: any[] = []
    try {
      pendingRuns = JSON.parse(pendingStr)
    } catch (e) {
      console.error("[SyncManager] Failed to parse pending runs", e)
      return
    }

    if (!Array.isArray(pendingRuns) || pendingRuns.length === 0) {
      setPendingCount(0)
      return
    }

    setPendingCount(pendingRuns.length)
    isSyncingRef.current = true

    console.log(`[SyncManager] Found ${pendingRuns.length} pending runs. Starting sync...`)
    
    const toastId = toast.loading(`正在同步 ${pendingRuns.length} 条离线跑步记录...`)

    const updatedPending = [...pendingRuns]
    let successCount = 0

    // Process one by one to avoid overwhelming or transaction conflicts
    for (const run of pendingRuns) {
      try {
        const result = await saveRunActivity(userId, {
          idempotencyKey: run.idempotencyKey,
          distance: run.distance,
          duration: run.duration,
          path: run.path,
          polygons: run.polygons || [],
          timestamp: run.timestamp,
          manualLocationCount: 0
        })

        if (result.success) {
          console.log(`[SyncManager] Successfully synced run: ${run.idempotencyKey}`)
          // Remove from local list
          const index = updatedPending.findIndex(p => p.idempotencyKey === run.idempotencyKey)
          if (index > -1) updatedPending.splice(index, 1)
          successCount++
        } else {
          console.warn(`[SyncManager] Failed to sync run ${run.idempotencyKey}:`, result.error)
        }
      } catch (err) {
        console.error(`[SyncManager] Error syncing run ${run.idempotencyKey}:`, err)
      }
    }

    // Update localStorage with remaining items
    if (updatedPending.length > 0) {
      localStorage.setItem(PENDING_KEY, JSON.stringify(updatedPending))
    } else {
      localStorage.removeItem(PENDING_KEY)
    }

    setPendingCount(updatedPending.length)
    isSyncingRef.current = false

    if (successCount > 0) {
      toast.success(`成功同步 ${successCount} 条跑步记录！`, { id: toastId })
      // Trigger refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('citylord:refresh-territories'))
      }
    } else {
      toast.dismiss(toastId)
    }
  }, [userId])

  // Monitor Network & Mount
  useEffect(() => {
    // Initial check on mount
    const timer = setTimeout(syncPendingRuns, 2000)

    const handleOnline = () => {
      console.log("[SyncManager] Network online, triggering sync...")
      syncPendingRuns()
    }

    window.addEventListener('online', handleOnline)
    
    // Periodically check every 5 minutes as a safety net
    const interval = setInterval(syncPendingRuns, 5 * 60 * 1000)

    return () => {
      clearTimeout(timer)
      clearInterval(interval)
      window.removeEventListener('online', handleOnline)
    }
  }, [syncPendingRuns])

  // Debug: Listen for specific "trigger-sync" events if needed
  useEffect(() => {
    const handleManualTrigger = () => syncPendingRuns()
    window.addEventListener('sync-pending-runs', handleManualTrigger)
    return () => window.removeEventListener('sync-pending-runs', handleManualTrigger)
  }, [syncPendingRuns])

  return null // Headless component
}
