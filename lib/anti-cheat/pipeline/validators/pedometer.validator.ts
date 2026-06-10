import { AntiCheatValidator, AntiCheatContext, AntiCheatCheckResult } from '../types';
import { ErrorCode } from '@/lib/api/errors';

export class PedometerValidator implements AntiCheatValidator {
    name = 'PedometerValidator';

    validate(ctx: AntiCheatContext): AntiCheatCheckResult {
        const { runData } = ctx;
        const distanceMeters = runData.distance;
        const steps = Number(runData.totalSteps ?? runData.steps ?? 0);

        if (steps === 0 && distanceMeters > 100) {
            return { passed: true, isFatal: false, riskScore: 0 };
        }

        const PEDOMETER_STRICT_DISTANCE_METERS = 500;
        const PEDOMETER_MIN_STEPS = 100;
        const PEDOMETER_MAX_STRIDE_METERS = 1.5;

        let cheatFlag: string | undefined;
        if (distanceMeters > PEDOMETER_STRICT_DISTANCE_METERS) {
            if (steps < PEDOMETER_MIN_STEPS) {
                cheatFlag = 'STEP_TOO_LOW';
            } else {
                const strideLength = distanceMeters / steps;
                if (strideLength > PEDOMETER_MAX_STRIDE_METERS) {
                    cheatFlag = 'STRIDE_TOO_LONG';
                }
            }
        }

        const strideLength = steps > 0 ? distanceMeters / steps : 0;
        if (strideLength > 0 && strideLength < 0.3) {
            cheatFlag = 'ABNORMAL_STRIDE_SHAKER';
        } else if (strideLength > 2.5) {
            cheatFlag = 'ABNORMAL_STRIDE_OVERGAITER';
        }

        if (cheatFlag) {
            return {
                passed: false,
                isFatal: true,
                errorCode: ErrorCode.CHEAT_INVALID_HARDWARE_DATA,
                cheatFlag,
                riskScore: 90
            };
        }

        return { passed: true, isFatal: false, riskScore: 0 };
    }
}
