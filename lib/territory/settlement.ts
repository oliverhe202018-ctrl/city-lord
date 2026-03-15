import * as turf from '@turf/turf';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PrismaClient, Prisma, TerritoryStatus } from '@prisma/client';

const prisma = new PrismaClient();

export interface SettlementInput {
    runId: string;
    userId: string;
    cityId: string;
    clubId?: string | null;
    pathGeoJSON: any; // Changed from turf.Feature to any to avoid lint issues
    score_weight?: number;
    db?: Prisma.TransactionClient;
}

export interface DamageDetail {
    territoryId: string;
    ownerName: string;
    damage: number;
    territoryType: string;
    isDestroyed: boolean;
    isCritical?: boolean;
}

export interface MaintenanceDetail {
    territoryId: string;
    type: 'HEAL' | 'FORTIFY' | 'BOTH';
    oldMaxHp: number;
    newMaxHp: number;
    beforeHp: number;
    afterHp: number;
    level: number;
}

export interface SettlementResult {
    success: boolean;
    createdTerritories: number;
    damagedTerritories: number;
    destroyedTerritories: number;
    damageDetails: DamageDetail[];
    maintenanceDetails: MaintenanceDetail[];
    error?: string;
}

/**
 * Handles the calculation and database persistence of territory overlaps, damage, and acquisition.
 */
export async function processTerritorySettlement(input: SettlementInput): Promise<SettlementResult> {
    const { runId, userId, cityId, clubId, pathGeoJSON, db } = input;
    const client = db || prisma;
    
    // 1. Validate Input
    if (!pathGeoJSON || !pathGeoJSON.geometry) {
        return { success: false, createdTerritories: 0, damagedTerritories: 0, destroyedTerritories: 0, damageDetails: [], maintenanceDetails: [], error: 'Invalid path geometry' };
    }

    const runAreaSqMeters = turf.area(pathGeoJSON);
    if (runAreaSqMeters < 50) {
        return { success: false, createdTerritories: 0, damagedTerritories: 0, destroyedTerritories: 0, damageDetails: [], maintenanceDetails: [], error: 'Run area too small' };
    }

    // Wrap single Polygon in MultiPolygon for consistent processing of split shapes
    let workingPolygons: any[] = [pathGeoJSON];

    let result: SettlementResult = {
        success: true,
        createdTerritories: 0,
        damagedTerritories: 0,
        destroyedTerritories: 0,
        damageDetails: [],
        maintenanceDetails: []
    };

    // Tracks territories already fortified in THIS run settlement to prevent multi-lap abuse
    const seenFortifiedTerritories = new Set<string>();

    // Damage Multipliers for Phase 3
    const DAMAGE_MULTIPLIERS: Record<string, number> = {
        'NORMAL': 1.0,
        'HOT': 2.0,
        'COLD': 0.5
    };
    const BASE_DAMAGE = 100;

    // 2. Fetch overlapping territories using PostGIS BBox/Intersects (Raw SQL)
    // We use raw SQL to leverage PostGIS capabilities and also read the geojson output easily
    // We only fetch ACTIVE territories
    const overlappingTerritories = await client.$queryRaw<any[]>`
        SELECT 
            id, 
            owner_id,
            owner_club_id,
            current_hp,
            max_hp,
            score_weight,
            territory_type,
            level,
            p.nickname as owner_name,
            ST_AsGeoJSON(geojson)::jsonb as geometry,
            ST_Contains(ST_GeomFromGeoJSON(${JSON.stringify(pathGeoJSON.geometry)}), geojson) as is_contained
        FROM territories t
        LEFT JOIN profiles p ON t.owner_id = p.id
        WHERE status = 'ACTIVE'::"TerritoryStatus"
        AND ST_Intersects(geojson, ST_GeomFromGeoJSON(${JSON.stringify(pathGeoJSON.geometry)}))
    `;

    const processLogic = async (tx: Prisma.TransactionClient) => {
        
        for (const existingTerr of overlappingTerritories) {
            // Self-owned or friendly club overlap check logic can be added here
            // For now, if it's the same owner, we might skip damage or apply healing. 
            // MVP: Assume any overlap causes damage unless owned by self.
            const existingFeature = turf.feature(existingTerr.geometry);

            if (existingTerr.owner_id === userId) {
                // Phase 4: Self-owned Territory Maintenance (Heal & Fortify)
                // 1. Double 90% Overlap Check
                const existingArea = turf.area(existingFeature);
                const intersection = turf.intersect(turf.featureCollection([pathGeoJSON as any, existingFeature as any]));
                
                if (!intersection) continue;
                
                const overlapArea = turf.area(intersection);
                const isDouble90 = (overlapArea / existingArea > 0.9) && (overlapArea / runAreaSqMeters > 0.9);

                if (isDouble90 && !seenFortifiedTerritories.has(existingTerr.id)) {
                    seenFortifiedTerritories.add(existingTerr.id);

                    const level = existingTerr.level || 1;
                    const oldMaxHp = existingTerr.max_hp;
                    const beforeHp = existingTerr.current_hp;
                    
                    let newMaxHp = oldMaxHp;
                    let newLevel = level;

                    // Fortify: Increase Max HP with diminishing returns if level < 10
                    if (level < 10) {
                        const delta = Math.round(200 * Math.pow(0.8, level - 1));
                        newMaxHp = oldMaxHp + delta;
                        newLevel = level + 1;
                    }

                    // Heal: Reset current HP to new Max HP
                    const afterHp = newMaxHp;

                    await tx.territories.update({
                        where: { id: existingTerr.id },
                        data: {
                            max_hp: newMaxHp,
                            current_hp: afterHp,
                            level: newLevel,
                            last_claimed_at: new Date()
                        }
                    });

                    await tx.territory_events.create({
                        data: {
                            territory_id: existingTerr.id,
                            event_type: 'FORTIFIED', // Unified type for Heal + Fortify in this phase
                            before_hp: beforeHp,
                            after_hp: afterHp,
                            damage_value: newMaxHp - oldMaxHp, // HP Gain
                            user_id: userId,
                            run_id: runId
                        } as any
                    });

                    result.maintenanceDetails.push({
                        territoryId: existingTerr.id,
                        type: newMaxHp > oldMaxHp ? 'FORTIFY' : 'HEAL',
                        oldMaxHp,
                        newMaxHp,
                        beforeHp,
                        afterHp,
                        level: newLevel
                    });
                }
                continue;
            }
            
            // Phase 3: Simplified Damage Model
            // Rules: If path intersects, deal BASE_DAMAGE * Multiplier.
            // No area overlap ratio considered in this phase.
            
            const territoryType = (existingTerr.territory_type || 'NORMAL') as string;
            const multiplier = DAMAGE_MULTIPLIERS[territoryType] || 1.0;
            
            // Crit Check: If fully contained and not self-owned, deal 3x damage
            const isCritical = existingTerr.is_contained === true;
            const damage = Math.ceil(BASE_DAMAGE * multiplier * (isCritical ? 3.0 : 1.0));

            /* 
            // OLD LOGIC (Phase 4 Foundation): Area-based accurate damage
            let overlapArea = 0;
            const intersection = turf.intersect(turf.featureCollection([pathGeoJSON as any, existingFeature as any]));
            if (intersection) {
                overlapArea = turf.area(intersection);
            }
            if (overlapArea < 10) continue; 
            const existingArea = turf.area(existingFeature);
            const overlapRatio = overlapArea / existingArea;
            const accurateDamage = Math.ceil(existingTerr.max_hp * overlapRatio * (input.score_weight ?? 1.0));
            */
            
            const beforeHp = existingTerr.current_hp;
            const afterHp = Math.max(0, beforeHp - damage);
            
            let finalStatus = 'ACTIVE';
            let destroyedAt = null;
            
            if (afterHp <= 0) {
                finalStatus = 'DESTROYED';
                destroyedAt = new Date();
                result.destroyedTerritories++;
            } else {
                result.damagedTerritories++;
            }

            // Update Target Territory
            await tx.territories.update({
                where: { id: existingTerr.id },
                data: {
                    current_hp: afterHp,
                    status: finalStatus as TerritoryStatus,
                    destroyed_at: destroyedAt
                }
            });

            // Record Event
            await tx.territory_events.create({
                data: {
                    territory_id: existingTerr.id,
                    event_type: finalStatus === 'DESTROYED' ? 'DESTROYED' : (isCritical ? 'CRIT_ATTACKED' : 'ATTACKED'),
                    damage_value: damage,
                    before_hp: beforeHp,
                    after_hp: afterHp,
                    user_id: userId,
                    run_id: runId
                } as any // Bypass strict TS errors for now if schema isn't fully synced
            });

            // Add to Damage Details for UI
            result.damageDetails.push({
                territoryId: existingTerr.id,
                ownerName: existingTerr.owner_name || '未知领主',
                damage: damage,
                territoryType: territoryType,
                isDestroyed: finalStatus === 'DESTROYED',
                isCritical: isCritical
            });

            // Perform turf.difference to carve out the claimed shapes so they don't overlap existing active territories
            const newWorkingPolygons: any[] = [];
            for (const poly of workingPolygons) {
                const diff = (turf as any).difference(turf.featureCollection([poly as any, existingFeature as any]));
                if (diff) {
                    newWorkingPolygons.push(diff);
                }
            }
            workingPolygons = newWorkingPolygons;
        }

        // 4. Generate New Territories
        // After carving out existing alive territories, we have 1 or more polygons representing empty space + destroyed territories space
        
        for (const poly of workingPolygons) {
            // Break down MultiPolygons into separate Polygons for independent territories if they are disjoint
            const shapes = splitIntoPolygons(poly);
            
            for (const shape of shapes) {
                const shapeArea = turf.area(shape);
                
                // Minimum area threshold for a new territory
                if (shapeArea < 50) continue; 

                // Generate ID
                const newId = `terr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                // Dual Write: raw SQL required for the standard PostGIS geometry column
                const geojsonStr = JSON.stringify(shape.geometry);
                
                await tx.$executeRawUnsafe(`
                    INSERT INTO territories (
                        id, 
                        owner_id, 
                        owner_club_id, 
                        geojson, 
                        geojson_json,
                        source_run_id,
                        first_claimed_at, 
                        last_claimed_at,
                        max_hp,
                        current_hp,
                        territory_type,
                        score_weight,
                        status
                    ) VALUES (
                        '${newId}', 
                        '${userId}', 
                        ${clubId ? `'${clubId}'` : 'NULL'}, 
                        ST_GeomFromGeoJSON('${geojsonStr}'::text), 
                        '${geojsonStr}'::jsonb,
                        '${runId}',
                        NOW(), 
                        NOW(),
                        1000,
                        1000,
                        'NORMAL'::"TerritoryType",
                        1.0,
                        'ACTIVE'::"TerritoryStatus"
                    )
                `);

                // Log Genesis event
                await tx.territory_events.create({
                    data: {
                        territory_id: newId,
                        event_type: 'CREATED',
                        user_id: userId,
                        run_id: runId
                    } as any 
                });

                result.createdTerritories++;
            }
        }
        return result; // Add return
    };

    if (db) {
        return await processLogic(db);
    } else {
        return await prisma.$transaction(processLogic);
    }
}

// Utility to flatten GeoJSON objects into Polygons
function splitIntoPolygons(feature: any): any[] {
    if (feature.geometry.type === 'Polygon') {
        return [feature];
    } else if (feature.geometry.type === 'MultiPolygon') {
        return feature.geometry.coordinates.map((coords: any) => turf.polygon(coords));
    }
    return [];
}
