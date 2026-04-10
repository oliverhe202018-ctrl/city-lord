import { PrismaClient } from '@prisma/client';
import { processTerritorySettlement } from '../lib/territory/settlement';
import * as turf from '@turf/turf';

const prisma = new PrismaClient();

async function main() {
    console.log("==================================================");
    console.log("MultiPolygon 拆分测试 (Option A Validations)");
    console.log("==================================================");

    try {
        const user = await prisma.profiles.findFirst();
        if (!user) {
            console.error("No user found.");
            return;
        }

        // 构造一个不相交的 MultiPolygon (例如两个小块组成的阵列)
        const multiPolygonFeature = turf.multiPolygon([
            // 第 1 块
            [[[116.300, 39.900], [116.301, 39.900], [116.301, 39.901], [116.300, 39.901], [116.300, 39.900]]],
            // 第 2 块
            [[[116.310, 39.910], [116.311, 39.910], [116.311, 39.911], [116.310, 39.911], [116.310, 39.910]]]
        ]);

        const runId = require('crypto').randomUUID();

        console.log(`[1] 模拟传入的 geometry.type: ${multiPolygonFeature.geometry.type}`);
        console.log(`    一共包含了 ${multiPolygonFeature.geometry.coordinates.length} 个独立块的坐标。`);

        // 调用 settlement 方法（内置 Option A 包含的 splitIntoPolygons 方法）
        console.log("\n[2] 调用 processTerritorySettlement 进行拆分与入库...");
        const result = await processTerritorySettlement({
            runId: runId,
            userId: user.id,
            pathGeoJSON: multiPolygonFeature as any
        } as any);

        console.log(`    返回结果: ${JSON.stringify(result)}`);

        // 从数据库查询刚刚生成的 territories
        console.log("\n[3] 验证数据库写入结果...");
        const newTerritories = await prisma.territories.findMany({
            where: { source_run_id: runId },
// @ts-expect-error - Baseline exemption for pre-existing schema mismatch - [Ticket-202603-SchemaSync] baseline exemption
            select: { id: true, geojson_json: true, area_m2: true }
        });

        console.log(`    找到 ${newTerritories.length} 条独立的 Polygon `);
        newTerritories.forEach((t, index) => {
            const geoJson = t.geojson_json as any;
            console.log(`    - 领地 ${index+1} (${t.id}):`);
            console.log(`      geomType: ${geoJson?.type}`);
// @ts-expect-error - Baseline exemption for pre-existing schema mismatch - [Ticket-202603-SchemaSync] baseline exemption
            console.log(`      area_m2:  ${t.area_m2}`);
        });

    } catch (e) {
        console.error("Error testing:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
