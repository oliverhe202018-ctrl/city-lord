/**
 * backfill-idempotency-keys.ts
 * 
 * 数据清洗脚本：将 runs 表中 idempotency_key 为 NULL 的历史记录回填为随机 UUID。
 * 必须在 prisma migrate 将 idempotency_key 改为 NOT NULL 之前执行。
 * 
 * 用法: npx tsx scripts/backfill-idempotency-keys.ts
 */

import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'

const prisma = new PrismaClient()

async function main() {
  console.log('[Backfill] 开始扫描 runs 表中 idempotency_key 为 NULL 的记录...')

  // 统计需要回填的记录数
  const nullCount = await prisma.runs.count({
    where: { idempotency_key: null }
  })

  if (nullCount === 0) {
    console.log('[Backfill] ✅ 无需回填，所有记录已有 idempotency_key')
    return
  }

  console.log(`[Backfill] 发现 ${nullCount} 条记录需要回填`)

  // 分批处理，每批 500 条
  const BATCH_SIZE = 500
  let processed = 0

  while (processed < nullCount) {
    const records = await prisma.runs.findMany({
      where: { idempotency_key: null },
      select: { id: true },
      take: BATCH_SIZE
    })

    if (records.length === 0) break

    // 批量更新
    const updatePromises = records.map(record =>
      prisma.runs.update({
        where: { id: record.id },
        data: { idempotency_key: `backfill_${uuidv4()}` }
      })
    )

    await Promise.all(updatePromises)
    processed += records.length
    console.log(`[Backfill] 已处理 ${processed}/${nullCount} 条`)
  }

  console.log(`[Backfill] ✅ 完成！共回填 ${processed} 条记录`)

  // 验证：确认没有 NULL 值残留
  const remainingNulls = await prisma.runs.count({
    where: { idempotency_key: null }
  })

  if (remainingNulls > 0) {
    console.error(`[Backfill] ❌ 仍有 ${remainingNulls} 条记录未回填！`)
    process.exit(1)
  } else {
    console.log('[Backfill] ✅ 验证通过，无 NULL 值残留')
  }
}

main()
  .catch((e) => {
    console.error('[Backfill] 执行失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
