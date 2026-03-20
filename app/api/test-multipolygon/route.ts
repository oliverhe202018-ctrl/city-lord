import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { processTerritorySettlement } from '@/lib/territory/settlement';
import * as turf from '@turf/turf';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const user = await prisma.profiles.findFirst();
        if (!user) {
            return NextResponse.json({ error: "No user found." }, { status: 400 });
        }

        // 构造一个不相交的 MultiPolygon (例如两个小块组成的阵列)
        const multiPolygonFeature = turf.multiPolygon([
            // 第 1 块
            [[[116.300, 39.900], [116.301, 39.900], [116.301, 39.901], [116.300, 39.901], [116.300, 39.900]]],
            // 第 2 块
            [[[116.310, 39.910], [116.311, 39.910], [116.311, 39.911], [116.310, 39.911], [116.310, 39.910]]]
        ]);

        const runId = `test-run-${Date.now()}`;

        // 调用 settlement 方法（内置 Option A 包含的 splitIntoPolygons 方法）
        // @ts-expect-error - FIXME: Argument of type '{ runId: string; userId: string; pathGeoJSON: any; }
        const result = await processTerritorySettlement({
            runId: runId,
            userId: user.id,
            pathGeoJSON: multiPolygonFeature as any // Type assertion to bypass strict typing if needed
        });

        // 从数据库查询刚刚生成的 territories
        const newTerritories = await prisma.territories.findMany({
            where: { source_run_id: runId },
            select: { id: true, geojson_json: true, area_m2: true }
        });

        const formattedResults = newTerritories.map(t => {
            const geoJson = t.geojson_json as any;
            return {
                id: t.id,
                geomType: geoJson?.type,
                area_m2: t.area_m2
            };
        });

        return NextResponse.json({
            originalInputType: multiPolygonFeature.geometry.type,
            inputSubPolygonsCount: multiPolygonFeature.geometry.coordinates.length,
            settlementResult: result,
            dbOutputCount: newTerritories.length,
            databaseRecords: formattedResults
        });

    } catch (e: any) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    } finally {
        await prisma.$disconnect();
    }
}
