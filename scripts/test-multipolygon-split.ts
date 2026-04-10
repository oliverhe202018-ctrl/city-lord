import { PrismaClient } from '@prisma/client';
import { processTerritorySettlement } from '../lib/territory/settlement';
import * as turf from '@turf/turf';
import type { Feature, Polygon, MultiPolygon } from 'geojson';

// 显式声明与 Prisma 返回一致的 DB GeoJSON 类型 (从 JsonValue 安全转化)
export interface DatabaseGeoJSON {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
}

// 运行时类型守卫：安全验证 Prisma 宽泛 JSON 结构
export function isDatabaseGeoJSON(data: unknown): data is DatabaseGeoJSON {
    return (
        data !== null &&
        typeof data === 'object' &&
        'type' in data &&
        'coordinates' in data
    );
}

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

        // 构造一个不相交的 MultiPolygon (由 turf 自动推导为 Feature<MultiPolygon>)
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
            cityId: "test_city",
            pathGeoJSON: multiPolygonFeature
        });

        console.log(`    返回结果: ${JSON.stringify(result)}`);

        // 从数据库查询刚刚生成的 territories
        console.log("\n[3] 验证数据库写入结果...");
        const newTerritories = await prisma.territories.findMany({
            where: { source_run_id: runId },
            select: { id: true, geojson_json: true, area_m2_exact: true }
        });

        console.log(`    找到 ${newTerritories.length} 条独立的 Polygon `);
        newTerritories.forEach((t, index) => {
            if (!isDatabaseGeoJSON(t.geojson_json)) {
                throw new Error(`领地 ${t.id} 的 GeoJSON 格式损坏或未写入`);
            }
            const geoJson = t.geojson_json;
            console.log(`    - 领地 ${index+1} (${t.id}):`);
            console.log(`      geomType: ${geoJson.type}`);
            console.log(`      area_m2_exact:  ${t.area_m2_exact}`);
        });

    } catch (e) {
        console.error("Error testing:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
