import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const user = await prisma.profiles.findFirst();
        if (!user) { 
            console.log("No user found in DB, skipping mock."); 
            return; 
        }
        
        await prisma.$executeRawUnsafe(`
            INSERT INTO territories (
                id, city_id, owner_id, current_hp, max_hp, territory_type, score_weight, status, area_m2, geojson_json
            ) VALUES (
                'mock-polygon-001', '110000', $1, 1000, 1000, 'NORMAL', 1.0, 'ACTIVE', 15000, 
                '{"type":"Polygon","coordinates":[[[116.390, 39.900], [116.400, 39.900], [116.400, 39.910], [116.390, 39.910], [116.390, 39.900]]]}'::jsonb
            )
            ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';
        `, user.id);
        
        console.log("Mock territory created successfully.");
    } catch (e) {
        console.error("Error creating mock:", e);
    }
}

main().finally(() => prisma.$disconnect());
