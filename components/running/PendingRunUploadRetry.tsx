"use client";

import { useEffect } from "react";

const PENDING_KEY = "PENDING_RUN_UPLOAD";

/**
 * PendingRunUploadRetry
 *
 * Silently retries failed run uploads on app start.
 * Runs once on mount, checks localStorage for PENDING_RUN_UPLOAD,
 * and POSTs to /api/run/save if data exists.
 * Clears the cache on success; leaves it for the next retry on failure.
 */
export function PendingRunUploadRetry() {
    useEffect(() => {
        const retryPendingUpload = async () => {
            try {
                const raw = localStorage.getItem(PENDING_KEY);
                if (!raw) return;

                const data = JSON.parse(raw) as {
                    distanceMeters: number;
                    durationSeconds: number;
                    steps: number;
                    area: number;
                    calories: number;
                    timestamp: number;
                };

                // Only retry if data is less than 7 days old
                const AGE_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;
                if (Date.now() - data.timestamp > AGE_LIMIT_MS) {
                    localStorage.removeItem(PENDING_KEY);
                    return;
                }

                // Attempt silent retry via API route (avoids importing server actions in client)
                const res = await fetch("/api/run/save-pending", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                        distanceMeters: data.distanceMeters,
                        durationSeconds: data.durationSeconds,
                        steps: data.steps,
                        area: data.area,
                        calories: data.calories,
                    }),
                });

                if (res.ok) {
                    localStorage.removeItem(PENDING_KEY);
                    console.log("[PendingRunUploadRetry] Pending run uploaded successfully.");
                } else {
                    console.warn("[PendingRunUploadRetry] Retry failed, will try again next session.");
                }
            } catch (e) {
                // Network error or JSON parse error — leave data for next retry
                console.warn("[PendingRunUploadRetry] Retry error:", e);
            }
        };

        // Delay slightly to avoid blocking initial render
        const timer = setTimeout(retryPendingUpload, 3000);
        return () => clearTimeout(timer);
    }, []);

    return null;
}
