/**
 * Shared formatting utilities for running data.
 *
 * SINGLE SOURCE OF TRUTH — all pages must import from here.
 *
 * Contract:
 *  - Database stores `distance` in **meters** and `duration` in **seconds**.
 *  - `saveRunActivity` (run-service.ts L57) writes `runData.distance` (meters) directly.
 */

// ─── Duration ─────────────────────────────────────────────
/** Format seconds → "HH:MM:SS". Safe for 0 / NaN / undefined. */
export function formatDuration(seconds: number | null | undefined): string {
    const sec = Math.max(0, Math.floor(Number(seconds) || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ─── Pace ─────────────────────────────────────────────────
/**
 * Format average pace → "mm'ss\"" (minutes per km).
 * @param seconds  Total run duration in seconds
 * @param km       Total distance in **kilometers** (NOT meters)
 */
export function formatPace(seconds: number | null | undefined, km: number | null | undefined): string {
    const s = Number(seconds) || 0;
    const k = Number(km) || 0;
    if (k < 0.01 || s <= 0) return "--'--\"";
    const paceSeconds = s / k;
    if (!isFinite(paceSeconds) || paceSeconds <= 0) return "--'--\"";
    const m = Math.floor(paceSeconds / 60);
    const sec = Math.floor(paceSeconds % 60);
    if (m > 99) return "99'59\"";
    return `${m.toString().padStart(2, '0')}'${sec.toString().padStart(2, '0')}"`;
}

// ─── Distance ─────────────────────────────────────────────
/** Convert meters → km (number). */
export function metersToKm(meters: number | null | undefined): number {
    const m = Number(meters) || 0;
    return m / 1000;
}

/**
 * Format distance for display.
 * Input is always **meters**.
 * Returns object for flexible rendering (e.g. value + unit separately).
 */
export function formatDistanceDisplay(meters: number | null | undefined): { value: string; unit: string } {
    const m = Math.max(0, Number(meters) || 0);
    if (m < 1000) {
        return { value: String(Math.round(m)), unit: 'm' };
    }
    return { value: (m / 1000).toFixed(2), unit: 'km' };
}

/**
 * Format distance as a single string, always in km.
 * Input is always **meters**.
 */
export function formatDistanceKm(meters: number | null | undefined): string {
    const m = Math.max(0, Number(meters) || 0);
    return (m / 1000).toFixed(2);
}
