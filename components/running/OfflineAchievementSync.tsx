"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { checkRunEndAchievements, type RunEndAchievementPayload } from "@/app/actions/check-achievements";

const OFFLINE_QUEUE_KEY = "pending_offline_runs";

export function OfflineAchievementSync() {
    const isSyncingRef = useRef(false);

    useEffect(() => {
        const syncOfflineAchievements = async () => {
            if (typeof window === "undefined" || !navigator.onLine || isSyncingRef.current) return;

            let queue: RunEndAchievementPayload[] = [];
            try {
                const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
                if (!raw) return;
                queue = JSON.parse(raw);
                if (!Array.isArray(queue) || queue.length === 0) return;
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
