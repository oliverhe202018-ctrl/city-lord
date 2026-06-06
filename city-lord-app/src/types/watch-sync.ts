/**
 * TypeScript interfaces for smartwatch running data sync.
 * Strict typing — no `any` allowed.
 */

/** A single GPS track point from smartwatch data */
export interface WatchTrackPoint {
    lat: number;
    lng: number;
    /** Unix timestamp in milliseconds */
    timestamp: number;
    /** Heart rate in bpm (optional) */
    heartRate?: number;
    /** Pace in min/km as a decimal (optional) */
    pace?: number;
}

/** Summary statistics from the smartwatch run */
export interface WatchRunSummary {
    /** Total distance in meters */
    totalDistance: number;
    /** Total step count */
    totalSteps: number;
    /** Start time as ISO 8601 string */
    startTime: string;
    /** End time as ISO 8601 string */
    endTime: string;
}

/** Payload submitted to the sync Server Action */
export interface WatchSyncPayload {
    points: WatchTrackPoint[];
    summary: WatchRunSummary;
}

/** Result returned from the sync Server Action */
export interface WatchSyncResult {
    success: boolean;
    /** ID of the created watch_activities record */
    activityId?: string;
    /** ID of the associated runs record (if territory created) */
    runId?: string;
    /** Whether a territory was successfully generated */
    territoryCreated?: boolean;
    /** Territory area in m² (if created) */
    territoryArea?: number;
    /** Error message on failure */
    error?: string;
    /** Non-fatal warnings (e.g. drift points removed) */
    warnings?: string[];
}
