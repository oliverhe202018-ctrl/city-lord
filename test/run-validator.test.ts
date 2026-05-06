import { describe, it, expect } from 'vitest';
import { validateRunData } from '../lib/validators/run-validator';

describe('Anti-Cheat Run Validator', () => {
  it('should validate a normal run', () => {
    const payload = {
      distanceMeters: 1000,
      durationSeconds: 600, // 10 km/h
      steps: 1000, // 1.0m stride
    };
    const result = validateRunData(payload);
    expect(result.isValid).toBe(true);
    expect(result.isFlagged).toBe(false);
  });

  it('should flag excessive speed (> 30 km/h)', () => {
    const payload = {
      distanceMeters: 1000,
      durationSeconds: 60, // 60 km/h
      steps: 1000,
    };
    const result = validateRunData(payload);
    expect(result.isFlagged).toBe(true);
    expect(result.flagReason).toBe('SPEED_TOO_HIGH');
  });

  it('should flag abnormal stride (step shaker - too small)', () => {
    const payload = {
      distanceMeters: 1000,
      durationSeconds: 600,
      steps: 5000, // 0.2m stride
    };
    const result = validateRunData(payload);
    expect(result.isFlagged).toBe(true);
    expect(result.flagReason).toBe('ABNORMAL_STRIDE_SHAKER');
  });

  it('should flag abnormal stride (vehicle - too large)', () => {
    const payload = {
      distanceMeters: 1000,
      durationSeconds: 600,
      steps: 100, // 10m stride
    };
    const result = validateRunData(payload);
    expect(result.isFlagged).toBe(true);
    expect(result.flagReason).toBe('ABNORMAL_STRIDE_OVERGAITER'); // Based on 2.5m threshold I set in code
  });

  it('should flag teleportation (distance > 500m in < 60s)', () => {
    const payload = {
      distanceMeters: 600,
      durationSeconds: 30,
      steps: 100,
    };
    const result = validateRunData(payload);
    expect(result.isFlagged).toBe(true);
    expect(result.flagReason).toBe('TELEPORTATION');
  });

  it('should flag zero steps with significant distance', () => {
    const payload = {
      distanceMeters: 500,
      durationSeconds: 300,
      steps: 0,
    };
    const result = validateRunData(payload);
    expect(result.isFlagged).toBe(true);
    expect(result.flagReason).toBe('ABNORMAL_STRIDE_ZERO_STEPS');
  });

  it('should flag invalid duration with distance (data tampering)', () => {
    const payload = {
      distanceMeters: 500,
      durationSeconds: 0,
      steps: 100,
    };
    const result = validateRunData(payload);
    expect(result.isValid).toBe(false);
    expect(result.isFlagged).toBe(true);
    expect(result.flagReason).toBe('INVALID_INPUT_DATA_TAMPERING');
  });
});
