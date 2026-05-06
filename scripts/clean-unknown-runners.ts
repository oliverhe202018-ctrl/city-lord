import { prisma } from "@/lib/prisma"

async function cleanUnknownRunners() {
  console.log('[clean-unknown-runners] 开始扫描脏数据...')

  const candidates = await prisma.profiles.findMany({
    where: {
      nickname: '未知跑者',
      total_area: { equals: 0 },
      total_distance_km: { equals: 0 },
      total_runs_count: { equals: 0 },
      is_active: true,
    },
    select: { id: true, nickname: true, created_at: true },
  })

  console.log(`[clean-unknown-runners] 发现 ${candidates.length} 条候选脏数据`)

  if (candidates.length === 0) {
    console.log('[clean-unknown-runners] 无脏数据，退出')
    return { cleaned: 0 }
  }

  const ids = candidates.map((c) => c.id)

  const result = await prisma.profiles.updateMany({
    where: { id: { in: ids } },
    data: { is_active: false },
  })

  console.log(`[clean-unknown-runners] 已将 ${result.count} 条记录标记为 is_active=false`)
  return { cleaned: result.count }
}

cleanUnknownRunners()
  .then((r) => {
    console.log('[clean-unknown-runners] ✅ 完成:', r)
    process.exit(0)
  })
  .catch((e) => {
    console.error('[clean-unknown-runners] ❌ 失败:', e)
    process.exit(1)
  })
