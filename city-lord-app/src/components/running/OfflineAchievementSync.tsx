"use client";

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { checkRunEndAchievements } from "@/app/actions/check-achievements";
import type { RunEndAchievementPayload } from "@/app/actions/check-achievements";
import { safeParseQueue } from "@/lib/offline-queue";

const OFFLINE_QUEUE_KEY = "pending_offline_runs";
const MAX_QUEUE_SIZE = 50;
const BACKOFF_MS = 60_000;

export function OfflineAchievementSync() {
    const isSyncingRef = useRef(false);
    const lastFailTimeRef = useRef(0);

    useEffect(() => {
        const syncOfflineAchievements = async () => {
            if (typeof window === "undefined" || !navigator.onLine || isSyncingRef.current) return;

            if (Date.now() - lastFailTimeRef.current < BACKOFF_MS) {
                console.debug("[OfflineAchievementSync] Backoff active, skipping sync");
                return;
            }

            let queue: RunEndAchievementPayload[] = [];
            try {
                const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
                if (!raw) return;
                // [P6] 离线队列 JSON 免疫：使用 safeParseQueue 防御损坏数据
                queue = safeParseQueue<RunEndAchievementPayload>(raw, OFFLINE_QUEUE_KEY);
                if (queue.length === 0) return;

                if (queue.length > MAX_QUEUE_SIZE) {
                    console.warn(`[OfflineAchievementSync] Queue overflow (${queue.length}), trimming to ${MAX_QUEUE_SIZE}`);
                    queue = queue.slice(-MAX_QUEUE_SIZE);
                    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
                }
            } catch (e) {
                console.warn("[OfflineAchievementSync] Queue parse error:", e);
                return;
            }

            isSyncingRef.current = true;
            let hasSynced = false;
            let hasAwarded = false;

            try {
                for (let i = 0; i < queue.length; i++) {
                    const payload = queue[i];

                    try {
                        const result = await checkRunEndAchievements(payload);

                        if (result.success) {
                            queue.splice(i, 1);
                            i--;
                            hasSynced = true;

                            if (result.awarded && result.awarded.length > 0) {
                                hasAwarded = true;
                            }
                        } else {
                            console.warn(`[OfflineAchievementSync] Sync rejected for endTime=${payload.endTime}: ${result.error}`);
                            break;
                        }
                    } catch (e) {
                        console.error("[OfflineAchievementSync] Fetch error:", e);
                        lastFailTimeRef.current = Date.now();
                        break;
                    }
                }

                if (queue.length === 0) {
                    localStorage.removeItem(OFFLINE_QUEUE_KEY);
                } else {
                    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
                }

                if (hasSynced) {
                    if (hasAwarded) {
                        toast.success("离线成就数据已同步");
                    }
                }
            } finally {
                isSyncingRef.current = false;
            }
        };

        const timer = setTimeout(syncOfflineAchievements, 5000);
        window.addEventListener("online", syncOfflineAchievements);

        return () => {
            clearTimeout(timer);
            window.removeEventListener("online", syncOfflineAchievements);
        };
    }, []);

    return null;
}
