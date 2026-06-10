import { AntiCheatValidator, AntiCheatContext, AntiCheatCheckResult } from '../types';
import { ErrorCode } from '@/lib/api/errors';
import { ANTI_CHEAT_MOCK_PERCENT_THRESHOLD } from '@/lib/constants/anti-cheat';

export class MockLocationValidator implements AntiCheatValidator {
    name = 'MockLocationValidator';

    validate(ctx: AntiCheatContext): AntiCheatCheckResult {
        const path = ctx.pathPoints;
        if (!path || path.length === 0) {
            return { passed: true, isFatal: false, riskScore: 0 };
        }

        const isDev = process.env.NODE_ENV === 'development';
        let mockCount = 0;
        for (const pt of path) {
            if (pt.isMock && !isDev) {
                mockCount++;
            }
        }

        const mockPercent = (mockCount / path.length) * 100;
        if (mockPercent >= ANTI_CHEAT_MOCK_PERCENT_THRESHOLD) {
            return {
                passed: false,
                isFatal: true,
                errorCode: ErrorCode.CHEAT_MOCK_LOCATION_DETECTED,
                cheatFlag: 'HIGH_MOCK_LOCATION_RATIO',
                riskScore: 50
            };
        } else if (mockPercent > 0) {
            return {
                passed: false,
                isFatal: false,
                cheatFlag: 'SOME_MOCK_LOCATION',
                riskScore: 20
            };
        }

        return { passed: true, isFatal: false, riskScore: 0 };
    }
}
