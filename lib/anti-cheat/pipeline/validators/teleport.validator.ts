import { AntiCheatValidator, AntiCheatContext, AntiCheatCheckResult } from '../types';
import { ErrorCode } from '@/lib/api/errors';
import { getDistanceFromLatLonInMeters } from '@/lib/geometry-utils';
import { ANTI_CHEAT_MAX_SPEED_KMH, ANTI_CHEAT_MAX_GAP_SECONDS } from '@/lib/constants/anti-cheat';

export class TeleportValidator implements AntiCheatValidator {
    name = 'TeleportValidator';

    validate(ctx: AntiCheatContext): AntiCheatCheckResult {
        const { runData, pathPoints } = ctx;
        const distanceMeters = runData.distance;
        const durationSeconds = runData.duration;
        const steps = Number(runData.totalSteps ?? runData.steps ?? 0);

        if (durationSeconds <= 0 || distanceMeters < 0 || steps < 0) {
            if (distanceMeters > 0) {
                return {
                    passed: false,
                    isFatal: true,
                    errorCode: ErrorCode.BIZ_VALIDATION_FAILED as any,
                    cheatFlag: 'INVALID_INPUT_DATA_TAMPERING',
                    riskScore: 100
                };
            }
            return { passed: true, isFatal: false, riskScore: 0 };
        }

        // 1. Overall Teleportation / Vehicle checks
        if (durationSeconds < 60 && distanceMeters > 500) {
            return { passed: false, isFatal: true, errorCode: ErrorCode.CHEAT_SPEED_TOO_HIGH, cheatFlag: 'TELEPORTATION', riskScore: 100 };
        }
        
        const avgSpeedKmH = (distanceMeters / 1000) / (durationSeconds / 3600);
        if (avgSpeedKmH > 30) {
            return { passed: false, isFatal: true, errorCode: ErrorCode.CHEAT_SPEED_TOO_HIGH, cheatFlag: 'SPEED_TOO_HIGH', riskScore: 100 };
        }

        // 2. Trajectory density check (MVP rules)
        const distanceKm = distanceMeters / 1000;
        if (distanceKm >= 0.05) {
            const density = pathPoints.length / distanceKm;
            if (density < 10) {
                return { passed: false, isFatal: true, errorCode: ErrorCode.CHEAT_INVALID_HARDWARE_DATA, cheatFlag: 'FAKE_TRAJECTORY', riskScore: 100 };
            }
        }

        // 3. Segment by Segment check
        let serverDistance = 0;
        let speedExceeded = false;
        let gapExceeded = false;

        if (pathPoints.length >= 2) {
            const startTimestamp = pathPoints[0].timestamp;
            const endTimestamp = pathPoints[pathPoints.length - 1].timestamp;
            ctx.serverDurationSec = Math.max(0, Math.floor((endTimestamp - startTimestamp) / 1000));

            for (let i = 1; i < pathPoints.length; i++) {
                const prev = pathPoints[i - 1];
                const curr = pathPoints[i];
                const dist = getDistanceFromLatLonInMeters(prev.lat, prev.lng, curr.lat, curr.lng);
                const timeDiff = Math.max(1, (curr.timestamp - prev.timestamp) / 1000);
                serverDistance += dist;

                const speedKmh = (dist / timeDiff) * 3.6;
                if (speedKmh > ANTI_CHEAT_MAX_SPEED_KMH && dist > 30) {
                    speedExceeded = true;
                }
                if (timeDiff > ANTI_CHEAT_MAX_GAP_SECONDS && dist > 500) {
                    gapExceeded = true;
                }
            }
        } else {
            serverDistance = distanceMeters;
            ctx.serverDurationSec = durationSeconds;
        }

        ctx.serverDistanceKm = serverDistance / 1000;

        let riskScore = 0;
        let cheatFlag = undefined;

        if (speedExceeded) {
            riskScore += 30;
            cheatFlag = 'SPEED_LIMIT_EXCEEDED';
        }
        if (gapExceeded) {
            riskScore += 30;
            cheatFlag = 'TELEPORTATION_OR_GAP';
        }

        if (riskScore > 0) {
            // Segment checks are typically non-fatal in MVP unless combined. We just add risk score.
            return { passed: false, isFatal: false, cheatFlag, riskScore };
        }

        return { passed: true, isFatal: false, riskScore: 0 };
    }
}
