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

/** Format a date strictly in Asia/Shanghai (CST, UTC+8) timezone to avoid server/client mismatch. */
export function formatShanghaiDate(
    dateInput: string | Date | number | null | undefined,
    formatPattern: 'yyyy年MM月dd日 HH:mm' | 'MM月dd日' | 'yyyy年M月d日' | 'toLocale' | 'YYYY-MM-DD HH:mm'
): string {
    if (!dateInput) return '--';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '--';
    
    try {
        const formatter = new Intl.DateTimeFormat('zh-CN', {
            timeZone: 'Asia/Shanghai',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        
        const parts = formatter.formatToParts(d);
        const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
        
        const y = partMap.year;
        const m = partMap.month;
        const day = partMap.day;
        const hr = partMap.hour;
        const min = partMap.minute;

        const mNum = parseInt(m, 10);
        const dNum = parseInt(day, 10);
        
        if (formatPattern === 'yyyy年MM月dd日 HH:mm') {
            return `${y}年${m}月${day}日 ${hr}:${min}`;
        }
        if (formatPattern === 'MM月dd日') {
            return `${m}月${day}日`;
        }
        if (formatPattern === 'yyyy年M月d日') {
            return `${y}年${mNum}月${dNum}日`;
        }
        if (formatPattern === 'YYYY-MM-DD HH:mm') {
            return `${y}-${m}-${day} ${hr}:${min}`;
        }
        if (formatPattern === 'toLocale') {
            return `${y}/${m}/${day} · ${hr}:${min}`;
        }
        return `${y}-${m}-${day} ${hr}:${min}`;
    } catch (e) {
        console.error('Failed to format date in Shanghai timezone', e);
        return '--';
    }
}
