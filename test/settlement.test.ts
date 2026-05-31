import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as turf from '@turf/turf';

// Hoist mock setup
const {
    mockRunsFindUnique,
    mockProfilesFindUnique,
    mockTransaction,
    mockQueryRaw,
    mockExecuteRaw,
    mockTerritoriesUpdate,
    mockTerritoryEventsCreate,
} = vi.hoisted(() => {
    const mockRunsFindUnique = vi.fn();
    const mockProfilesFindUnique = vi.fn();
    const mockQueryRaw = vi.fn();
    const mockExecuteRaw = vi.fn();
    const mockTerritoriesUpdate = vi.fn();
    const mockTerritoryEventsCreate = vi.fn();

    const mockTx = {
        $queryRaw: mockQueryRaw,
        $executeRaw: mockExecuteRaw,
        profiles: {
            findUnique: mockProfilesFindUnique,
        },
        territories: {
            update: mockTerritoriesUpdate,
        },
        territory_events: {
            create: mockTerritoryEventsCreate,
        },
        random_events: {
            findMany: vi.fn().mockResolvedValue([]),
            updateMany: vi.fn().mockResolvedValue({}),
        },
    };

    const mockTransaction = vi.fn(async (fn: any) => fn(mockTx));

    return {
        mockRunsFindUnique,
        mockProfilesFindUnique,
        mockTransaction,
        mockQueryRaw,
        mockExecuteRaw,
        mockTerritoriesUpdate,
        mockTerritoryEventsCreate: mockTerritoryEventsCreate,
    };
});

vi.mock('@/lib/prisma', () => ({
    prisma: {
        runs: {
            findUnique: mockRunsFindUnique,
        },
        $transaction: mockTransaction,
    },
}));

vi.mock('@trigger.dev/sdk', () => ({
    tasks: {
        trigger: vi.fn().mockResolvedValue({ id: 'task-id' }),
    },
}));

vi.mock('@/lib/services/territory-stats-aggregator', () => ({
    TerritoryStatsAggregatorService: {
        processNextBatch: vi.fn().mockResolvedValue({}),
    },
}));

import { processTerritorySettlement } from '@/lib/territory/settlement';

describe('Territory Settlement Spatial Core', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default runs findUnique
        mockRunsFindUnique.mockResolvedValue({
            created_at: new Date(),
            duration: 1000,
            distance: 1000,
        });
        mockProfilesFindUnique.mockResolvedValue({
            faction: 'BLUE',
            crit_rate: 0.2, // 20% crit
        });
    });

    it('should split attacked enemy territory into residue and intersections, and deduct HP', async () => {
        // Create an enemy territory that intersects with the runner's path
        const enemyTerritory = {
            id: 'terr_enemy_123',
            owner_id: 'user_enemy_uuid',
            owner_faction: 'RED',
            owner_club_id: 'club_enemy_uuid',
            health: 100,
            current_hp: 1000,
            max_hp: 1000,
            score_weight: 1.0,
            territory_type: 'NORMAL',
            level: 1,
            owner_name: 'Enemy Lord',
            geometry: {
                type: 'Polygon',
                coordinates: [
                    [
                        [121.4, 31.2],
                        [121.5, 31.2],
                        [121.5, 31.3],
                        [121.4, 31.3],
                        [121.4, 31.2],
                    ],
                ],
            },
            is_contained: false,
            last_attacked_at: null,
        };

        // Query raw mocks
        mockQueryRaw
            .mockResolvedValueOnce([]) // bestPatrolOverlap
            .mockResolvedValueOnce([enemyTerritory]) // overlappingTerritories
            .mockResolvedValueOnce([ // hitZoneRows
                {
                    id: 'terr_enemy_123',
                    geometry: {
                        type: 'Polygon',
                        coordinates: [
                            [
                                [121.4, 31.2],
                                [121.45, 31.2],
                                [121.45, 31.25],
                                [121.4, 31.25],
                                [121.4, 31.2],
                            ],
                        ],
                    },
                },
            ])
            .mockResolvedValueOnce([{ id: 'terr_enemy_123' }]) // baseCampRows for userId
            .mockResolvedValueOnce([{ id: 'terr_enemy_456' }]); // baseCampRows for defenderId
        
        mockExecuteRaw.mockResolvedValue(1);

        // Run settlement
        const runnerPath = turf.polygon([
            [
                [121.39, 31.19],
                [121.46, 31.19],
                [121.46, 31.26],
                [121.39, 31.26],
                [121.39, 31.19],
            ],
        ]);

        const input = {
            runId: 'run_uuid_123',
            userId: 'user_runner_uuid',
            cityId: 'city_shanghai',
            clubId: 'club_runner_uuid',
            pathGeoJSON: runnerPath as any,
        };

        const result = await processTerritorySettlement(input);

        expect(result.success).toBe(true);
        expect(result.damagedTerritories).toBe(1);
        expect(result.destroyedTerritories).toBe(0);

        // Verify difference and intersection queries were executed
        expect(mockExecuteRaw).toHaveBeenCalled();
        expect(mockTerritoriesUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'terr_enemy_123' },
                data: expect.objectContaining({
                    status: 'SUPERSEDED',
                    current_hp: 0,
                }),
            })
        );
    });

    it('should capture enemy territory when HP drops to 0', async () => {
        // Create an enemy territory that intersects with the runner's path
        const enemyTerritory = {
            id: 'terr_enemy_123',
            owner_id: 'user_enemy_uuid',
            owner_faction: 'RED',
            owner_club_id: 'club_enemy_uuid',
            health: 10,
            current_hp: 50, // low HP
            max_hp: 1000,
            score_weight: 1.0,
            territory_type: 'NORMAL',
            level: 1,
            owner_name: 'Enemy Lord',
            geometry: {
                type: 'Polygon',
                coordinates: [
                    [
                        [121.4, 31.2],
                        [121.5, 31.2],
                        [121.5, 31.3],
                        [121.4, 31.3],
                        [121.4, 31.2],
                    ],
                ],
            },
            is_contained: true,
            last_attacked_at: null,
        };

        // Query raw mocks
        mockQueryRaw
            .mockResolvedValueOnce([]) // bestPatrolOverlap
            .mockResolvedValueOnce([enemyTerritory]) // overlappingTerritories
            .mockResolvedValueOnce([{ id: 'terr_enemy_123' }]) // baseCampRows for userId
            .mockResolvedValueOnce([{ id: 'terr_enemy_456' }]); // baseCampRows for defenderId
        
        mockExecuteRaw.mockResolvedValue(1);

        // Run settlement
        const runnerPath = turf.polygon([
            [
                [121.39, 31.19],
                [121.46, 31.19],
                [121.46, 31.26],
                [121.39, 31.26],
                [121.39, 31.19],
            ],
        ]);

        const input = {
            runId: 'run_uuid_123',
            userId: 'user_runner_uuid',
            cityId: 'city_shanghai',
            clubId: 'club_runner_uuid',
            pathGeoJSON: runnerPath as any,
        };

        const result = await processTerritorySettlement(input);

        expect(result.success).toBe(true);
        expect(result.damagedTerritories).toBe(0);
        expect(result.destroyedTerritories).toBe(1); // successfully destroyed/captured

        // Verify it was marked superseded
        expect(mockTerritoriesUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'terr_enemy_123' },
                data: expect.objectContaining({
                    status: 'SUPERSEDED',
                    current_hp: 0,
                }),
            })
        );
    });
});
