import * as turf from '@turf/turf';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export interface SettlementInput {
    runId: string;
    userId: string;
    clubId?: string | null;
    pathGeoJSON: turf.Feature<turf.Polygon | turf.MultiPolygon>;
    score_weight?: number;
}

export interface SettlementResult {
    success: boolean;
    createdTerritories: number;
    damagedTerritories: number;
    destroyedTerritories: number;
    error?: string;
}

/**
 * Handles the calculation and database persistence of territory overlaps, damage, and acquisition.
 */
export async function processTerritorySettlement(input: SettlementInput): Promise<SettlementResult> {
    const { runId, userId, clubId, pathGeoJSON } = input;
    
    // 1. Validate Input
    if (!pathGeoJSON || !pathGeoJSON.geometry) {
        return { success: false, createdTerritories: 0, damagedTerritories: 0, destroyedTerritories: 0, error: 'Invalid path geometry' };
    }

    const runAreaSqMeters = turf.area(pathGeoJSON);
    if (runAreaSqMeters < 50) {
        return { success: false, createdTerritories: 0, damagedTerritories: 0, destroyedTerritories: 0, error: 'Run area too small' };
    }

    // Wrap single Polygon in MultiPolygon for consistent processing of split shapes
    let workingPolygons: turf.Feature<turf.Polygon | turf.MultiPolygon>[] = [pathGeoJSON];

    let result = {
        success: true,
        createdTerritories: 0,
        damagedTerritories: 0,
        destroyedTerritories: 0
    };

    // 2. Fetch overlapping territories using PostGIS BBox/Intersects (Raw SQL)
    // We use raw SQL to leverage PostGIS capabilities and also read the geojson output easily
    // We only fetch ACTIVE territories
    const overlappingTerritories = await prisma.$queryRaw<any[]>`
        SELECT 
            id, 
            owner_id,
            owner_club_id,
            current_hp,
            max_hp,
            score_weight,
            ST_AsGeoJSON(geojson)::jsonb as geometry
        FROM territories
        WHERE status = 'ACTIVE'::"TerritoryStatus"
        AND ST_Intersects(geojson, ST_GeomFromGeoJSON(${JSON.stringify(pathGeoJSON.geometry)}))
    `;

    // 3. Process Overlaps & Calculate Damage
    // Calculate overlap precisely using turf.js
    
    // We need to keep a transaction to update HP, record events, and create new territories
    await prisma.$transaction(async (tx) => {
        
        for (const existingTerr of overlappingTerritories) {
            // Self-owned or friendly club overlap check logic can be added here
            // For now, if it's the same owner, we might skip damage or apply healing. 
            // MVP: Assume any overlap causes damage unless owned by self.
            if (existingTerr.owner_id === userId) {
                 // Skip self-damage 
                 continue;
            }

            const existingFeature = turf.feature(existingTerr.geometry);
            
            let overlapArea = 0;
            // Calculate precise intersection
            const intersection = turf.intersect(turf.featureCollection([pathGeoJSON as any, existingFeature as any]));
            
            if (intersection) {
                overlapArea = turf.area(intersection);
            }

            if (overlapArea < 10) continue; // Ignore microscopic overlaps

            const existingArea = turf.area(existingFeature);
            const overlapRatio = overlapArea / existingArea;
            
            // Damage calculation based on overlap ratio
            // Max damage = existing max HP
            const scoreWeight = input.score_weight ?? 1.0;
            const damage = Math.ceil(existingTerr.max_hp * overlapRatio * scoreWeight); // simplified math
            
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
                    event_type: finalStatus === 'DESTROYED' ? 'DESTROYED' : 'ATTACKED',
                    damage_value: damage,
                    before_hp: beforeHp,
                    after_hp: afterHp,
                    user_id: userId,
                    run_id: runId
                } as any // Bypass strict TS errors for now if schema isn't fully synced
            });

            // Perform turf.difference to carve out the claimed shapes so they don't overlap existing active territories
            const newWorkingPolygons: turf.Feature<turf.Polygon | turf.MultiPolygon>[] = [];
            for (const poly of workingPolygons) {
                const diff = turf.difference(turf.featureCollection([poly as any, existingFeature as any]));
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
    });

    return result;
}

// Utility to flatten Feature<Polygon | MultiPolygon> into Feature<Polygon>[]
function splitIntoPolygons(feature: turf.Feature<turf.Polygon | turf.MultiPolygon>): turf.Feature<turf.Polygon>[] {
    if (feature.geometry.type === 'Polygon') {
        return [feature as turf.Feature<turf.Polygon>];
    } else if (feature.geometry.type === 'MultiPolygon') {
        return feature.geometry.coordinates.map(coords => turf.polygon(coords));
    }
    return [];
}
