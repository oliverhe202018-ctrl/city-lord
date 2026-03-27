import { describe, it, expect } from 'vitest';
import { validateRunLegitimacy } from '../lib/anti-cheat/mvp-rules';

describe('Anti-Cheat MVP Rules', () => {
    it('should pass a normal marathon runner (5:00/km)', () => {
        const result = validateRunLegitimacy({
            distanceKm: 10,
            durationSeconds: 3000, // 50 mins = 5:00/km
            pathPointsCount: 500 // 50 points/km
        });
        expect(result.isValid).toBe(true);
    });

    it('should pass a fast sprinter (2:55/km)', () => {
        const result = validateRunLegitimacy({
            distanceKm: 1,
            durationSeconds: 175, // 2:55/km
            pathPointsCount: 60
        });
        expect(result.isValid).toBe(true);
    });

    it('should fail a vehicle user (2:00/km)', () => {
        const result = validateRunLegitimacy({
            distanceKm: 5,
            durationSeconds: 600, // 2:00/km < 2:30/km
            pathPointsCount: 100
        });
        expect(result.isValid).toBe(false);
        expect(result.reason).toBe('SPEED_TOO_FAST');
    });

    it('should fail a sparse trajectory (5 points for 1km)', () => {
        const result = validateRunLegitimacy({
            distanceKm: 1,
            durationSeconds: 400,
            pathPointsCount: 5 // 5 points/km < 10
        });
        expect(result.isValid).toBe(false);
        expect(result.reason).toBe('FAKE_TRAJECTORY');
    });

    it('should ignore extremely short distances (< 50m)', () => {
        const result = validateRunLegitimacy({
            distanceKm: 0.04,
            durationSeconds: 10,
            pathPointsCount: 5
        });
        expect(result.isValid).toBe(false);
        expect(result.reason).toBe('DISTANCE_TOO_SHORT');
    });
});
