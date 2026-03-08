import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'

// 将 getCachedTerritories 外提，避免每次在 GET 里重复初始化包装器
// unstable_cache 内部机制会自动将入参 (cityId) 序列化并加入缓存键，无需手写模板字符串
const getCachedTerritories = unstable_cache(
  async (cityId: string) => {
    return await prisma.territories.findMany({
      where: {
        city_id: cityId,
        status: 'active'
      },
      select: {
        id: true,
        owner_id: true,
        level: true,
        health: true,
        h3_index: true,
        profiles: {
          select: {
            nickname: true,
            avatar_url: true,
            faction: true
          }
        }
      }
    })
  },
  ['territories-list'], // 静态标识，加上入参自带的唯一性，足够隔离串库
  {
    revalidate: 60,
    tags: ['territories'] // 若未来无需单独对某个城市失效，保留一个大颗粒度 tag 足够
  }
)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const cityId = searchParams.get('cityId')

    if (!cityId) {
      return NextResponse.json({ error: 'cityId required' }, { status: 400 })
    }

    const territories = await getCachedTerritories(cityId)

    return NextResponse.json(territories)
  } catch (error: any) {
    console.error('Fetch territories error:', error)
    return NextResponse.json([], { status: 200 })
  }
}