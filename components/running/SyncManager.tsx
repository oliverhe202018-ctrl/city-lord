"use client"

import { useEffect, useCallback, useRef, useState } from "react"
import { toast } from "sonner"
import { saveRunActivity } from "@/app/actions/run-service"
import { useGameStore } from "@/store/useGameStore"
import { lineString as turfLineString, simplify as turfSimplify } from '@turf/turf'

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
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    try {
      const updatedPending = [...pendingRuns]
      let successCount = 0

      // Process one by one to avoid overwhelming or transaction conflicts
      for (const run of pendingRuns) {
        try {
          const distanceMeters = Math.max(0, Number(run.distance ?? 0));
          const estimatedSteps = Math.floor(distanceMeters * 1.3);
          const stepsForSubmit = Math.max(0, Math.floor(Number(run.totalSteps ?? run.steps ?? estimatedSteps)));

          // --- Client-side path simplification (Payload Fix) ---
          // 确保发送到服务端的 GPS 点数安全，防止突破 5MB 上限
          let pathToSend = run.path || [];
          if (pathToSend.length > 300) {
            try {
              const line = turfLineString(pathToSend.map((p: any) => [p.lng, p.lat]));
              const simplified = turfSimplify(line, { tolerance: 0.0001, highQuality: false });
              const simplifiedCoords = simplified.geometry.coordinates;
              const count = simplifiedCoords.length;
              const startTime = pathToSend[0]?.timestamp || Date.now();
              const endTime = pathToSend[pathToSend.length - 1]?.timestamp || Date.now();
              pathToSend = simplifiedCoords.map(([lng, lat]: number[], idx: number) => ({
                lat,
                lng,
                timestamp: Math.floor(startTime + (endTime - startTime) * (idx / Math.max(1, count - 1)))
              }));
              console.log(`[SyncManager] Path simplified: ${run.path.length} → ${pathToSend.length} pts`);
            } catch (e) {
              console.warn('[SyncManager] Path simplification failed, using raw path:', e);
            }
          }

          // Note: saveRunActivity is a server action. 
          // AbortController on fetch inside server actions is tricky, 
          // but we can race it here.
          const resultPromise = saveRunActivity(userId, {
            idempotencyKey: run.idempotencyKey,
            distance: run.distance,
            duration: run.duration,
            path: pathToSend,
            polygons: run.polygons || [],
            timestamp: run.timestamp,
            clubId: run.clubId ?? null,
            manualLocationCount: 0,
            totalSteps: stepsForSubmit,
            steps: stepsForSubmit,
            eventsHistory: run.eventsHistory || []
          }, run.clubId ?? null)

          const timeoutPromise = new Promise((_, reject) => {
            const id = setTimeout(() => {
              clearTimeout(id)
              reject(new Error('SYNC_TIMEOUT'))
            }, 10000)
          })

          const result: any = await Promise.race([resultPromise, timeoutPromise])

          if (result.success) {
            console.log(`[SyncManager] Successfully synced run: ${run.idempotencyKey}`)
            // Remove from local list
            const index = updatedPending.findIndex(p => p.idempotencyKey === run.idempotencyKey)
            if (index > -1) updatedPending.splice(index, 1)
            successCount++
          } else {
            console.warn(`[SyncManager] Failed to sync run ${run.idempotencyKey}:`, result.error)
          }
        } catch (err: any) {
          console.error(`[SyncManager] Error syncing run ${run.idempotencyKey}:`, err)
          if (err.message === 'SYNC_TIMEOUT') {
             toast.error("网络请求超时，请稍后手动重试", { id: toastId })
             break // Stop processing further runs if timed out
          }
        }
      }

      // Update localStorage with remaining items
      if (updatedPending.length > 0) {
        localStorage.setItem(PENDING_KEY, JSON.stringify(updatedPending))
      } else {
        localStorage.removeItem(PENDING_KEY)
      }

      setPendingCount(updatedPending.length)

      if (successCount > 0) {
        toast.success(`成功同步 ${successCount} 条跑步记录！`, { id: toastId })
        // Trigger refresh
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('citylord:refresh-territories'))
        }
      } else {
        toast.dismiss(toastId)
      }
    } finally {
      clearTimeout(timeoutId)
      isSyncingRef.current = false
    }
  }, [userId])

  // Monitor Network & Mount
  useEffect(() => {
    // 💀 Physical Castration per Execution Plan:
    // SyncManager's auto-sync is explicitly disabled to prevent it from uploading 
    // stale PENDING_RUN_UPLOAD entries and consuming the current active idempotencyKey.
    // All offline recoveries must be explicitly triggered by users in a controlled environment.
    return () => {}
  }, [syncPendingRuns])

  // Debug: Listen for specific "trigger-sync" events if needed
  useEffect(() => {
    const handleManualTrigger = () => syncPendingRuns()
    window.addEventListener('sync-pending-runs', handleManualTrigger)
    return () => window.removeEventListener('sync-pending-runs', handleManualTrigger)
  }, [syncPendingRuns])

  return null // Headless component
}
