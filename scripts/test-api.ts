import { PrismaClient } from '@prisma/client';

async function testApi() {
  const prisma = new PrismaClient();
  
  try {
    // 找一个真实的 owner_id 满足外键约束
    const profiles = await prisma.$queryRaw<any[]>`SELECT id FROM profiles LIMIT 1`;
    const ownerId = profiles[0]?.id;

    if (!ownerId) {
      console.log('[!] 数据库中没有 profiles，无法创建带外键的 dummy territory');
      return;
    }

    const testCityId = '999test';
    const testH3 = '89testcellid';
    
    // 插入一条 mock 数据 (使用 queryRaw 避免各种默认值限制)
    await prisma.$executeRaw`
      INSERT INTO territories (id, city_id, h3_index, owner_id) 
      VALUES ('dummy-test-id', ${testCityId}, ${testH3}, ${ownerId}::uuid)
    `;

    console.log('\n--- TEST 1: 真实存在的 territory (命中 case) ---');
    try {
      const resHit = await fetch(`http://localhost:3000/api/territories/by-cell?cityId=${testCityId}&h3CellId=${testH3}`);
      const jsonHit = await resHit.json();
      console.log(`    HTTP 状态码: ${resHit.status}`);
      console.log('    返回数据:', JSON.stringify(jsonHit, null, 2));
    } catch (e) {
      console.log('    Fetch failed:', e);
    }

    console.log('\n--- TEST 2: 不存在的 territory (未命中 case) ---');
    try {
      const resMiss = await fetch(`http://localhost:3000/api/territories/by-cell?cityId=999test&h3CellId=nonexistent`);
      const jsonMiss = await resMiss.json();
      console.log(`    HTTP 状态码: ${resMiss.status}`);
      console.log('    返回数据:', JSON.stringify(jsonMiss, null, 2));
    } catch (e) {
      console.log('    Fetch failed:', e);
    }
    
    // 清理
    await prisma.$executeRaw`DELETE FROM territories WHERE id = 'dummy-test-id'`;
    console.log('\n[+] 测试数据已清理');
    
  } finally {
    await prisma.$disconnect();
  }
}

testApi();
