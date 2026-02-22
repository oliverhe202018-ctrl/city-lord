"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { RunRecordDTO } from "@/types/run-sync";

const PENDING_KEY = "PENDING_RUN_UPLOAD";

export function PendingRunUploadRetry() {
    const isSyncingRef = useRef(false);

    useEffect(() => {
        const syncPendingRuns = async () => {
            if (typeof window === 'undefined' || !navigator.onLine || isSyncingRef.current) return;

            try {
                const raw = localStorage.getItem(PENDING_KEY);
                if (!raw) return;

                const pendingRuns: RunRecordDTO[] = JSON.parse(raw);
                if (!Array.isArray(pendingRuns) || pendingRuns.length === 0) return;

                isSyncingRef.current = true;
                let successCount = 0;
                let newPending = [...pendingRuns];

                // Process sequentially
                for (let i = 0; i < pendingRuns.length; i++) {
                    const record = pendingRuns[i];

                    // Age limit check (7 days)
                    const AGE_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;
                    if (Date.now() - record.timestamp > AGE_LIMIT_MS) {
                        newPending = newPending.filter(r => r.idempotencyKey !== record.idempotencyKey);
                        continue;
                    }

                    try {
                        const res = await fetch(`${process.env.NEXT_PUBLIC_API_SERVER || ''}/api/run/save-pending`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                            body: JSON.stringify(record),
                        });

                        if (res.ok) {
                            successCount++;
                            newPending = newPending.filter(r => r.idempotencyKey !== record.idempotencyKey);
                        } else if (res.status === 401) {
                            console.warn("[PendingRunUploadRetry] Unauthorized, suspending sync.");
                            break;
                        } else {
                            console.warn(`[PendingRunUploadRetry] Sync failed for ${record.idempotencyKey}`);
                        }
                    } catch (e) {
                        console.error("[PendingRunUploadRetry] Fetch error:", e);
                        break;
                    }
                }

                if (successCount > 0) {
                    if (newPending.length === 0) {
                        localStorage.removeItem(PENDING_KEY);
                    } else {
                        localStorage.setItem(PENDING_KEY, JSON.stringify(newPending));
                    }
                    toast.success(`后台已成功同步 ${successCount} 条离线运动记录 🏃`, {
                        description: "离线数据未丢失"
                    });
                } else if (newPending.length < pendingRuns.length) {
                    // Just removed expired ones
                    localStorage.setItem(PENDING_KEY, JSON.stringify(newPending));
                }

            } catch (e) {
                console.warn("[PendingRunUploadRetry] Parse error:", e);
            } finally {
                isSyncingRef.current = false;
            }
        };

        const timer = setTimeout(syncPendingRuns, 3000);
        window.addEventListener('online', syncPendingRuns);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('online', syncPendingRuns);
        };
    }, []);

    return null;
}
