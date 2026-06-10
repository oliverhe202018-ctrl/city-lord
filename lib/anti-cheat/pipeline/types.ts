import { RunRecordDTO } from '@/types/run-sync';
import { ErrorCode } from '@/lib/api/errors';

export interface Point {
    lat: number;
    lng: number;
    timestamp: number;
    isMock?: boolean;
}

export interface AntiCheatContext {
    userId: string;
    runData: RunRecordDTO;
    isTester: boolean;
    // Shared State: Avoid recalculating loops/polygons
    pathPoints: Point[];
    // Deferred database log storage for transactions
    violations?: any[];
    // Computed Values to be filled by validators
    serverDistanceKm?: number;
    serverDurationSec?: number;
    finalPolygons?: Point[][];
    accurateAreaKm2?: number;
    diagData?: any;
}

export interface AntiCheatCheckResult {
    passed: boolean;
    isFatal: boolean; // if true, throw error
    errorCode?: ErrorCode;
    cheatFlag?: string;
    riskScore: number;
    // Computed outputs to be merged into context by the pipeline
    computedData?: {
        finalPolygons?: Point[][];
        accurateAreaKm2?: number;
        diagData?: any;
    };
}

export interface AntiCheatValidator {
    name: string;
    validate(ctx: AntiCheatContext): Promise<AntiCheatCheckResult> | AntiCheatCheckResult;
}
