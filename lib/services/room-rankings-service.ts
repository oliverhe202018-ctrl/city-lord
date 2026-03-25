import { prisma } from '@/lib/prisma'
import { DEFAULT_TERRITORY_AREA_KM2 } from '@/lib/constants/territory'

export interface RankingItem {
  rank: number
  userId: string
  name: string
  avatar: string
  value: number | string
}

export class RoomRankingsService {
  /**
   * 获取房间排行榜数据
   * @param roomId 房间 ID
   * @param filter 过滤维度: 'overall' | 'ratio' | 'rivals' | 'stealers' | 'gainers' | 'losers'
   */
  static async getRankings(roomId: string, filter: string = 'overall'): Promise<RankingItem[]> {
    const validFilters = ['overall', 'ratio', 'rivals', 'stealers', 'gainers', 'losers']
    if (!validFilters.includes(filter)) {
      throw new Error('Invalid filter dimension')
    }

    let results: any[] = []

    // 1. 获取核心统计数据
    switch (filter) {
      case 'overall':
      case 'ratio':
        results = await this.getOverallData(roomId)
        break
      case 'rivals':
        results = await this.getRivalsData(roomId)
        break
      case 'stealers':
        results = await this.getStealersData(roomId)
        break
      case 'gainers':
      case 'losers':
        results = await this.getGrowthData(roomId)
        break
    }

    // 2. 内存计算与格式化
    let formattedResults: any[] = results.map(item => ({
      userId: item.userId as string,
      name: (item.name || 'Unknown') as string,
      avatar: (item.avatar || '') as string,
      value: Number(item.value_count || 0)
    }))

    // 特殊处理: ratio 在内存中计算比例
    if (filter === 'ratio') {
      const totalCount = formattedResults.reduce((sum, item) => sum + item.value, 0)
      formattedResults = formattedResults.map(item => ({
        ...item,
        value: totalCount > 0 ? ((item.value / totalCount) * 100).toFixed(2) + '%' : '0%'
      }))
    } else if (filter === 'overall' || filter === 'stealers' || filter === 'gainers' || filter === 'losers') {
      // 领地数转换为面积 (此处使用预设面积，未来应使用多边形真实面积)
      formattedResults = formattedResults.map(item => ({
        ...item,
        value: (item.value * DEFAULT_TERRITORY_AREA_KM2).toFixed(4)
      }))
    }

    // 3. 排序 (JS 内存排序, 安全且灵活)
    formattedResults.sort((a, b) => {
      if (filter === 'losers') {
         // 失地榜: 增长量从低到高 (最负的在前面)
         return Number(a.value) - Number(b.value)
      }
      // 其他榜单: 从高到低
      if (typeof a.value === 'string' && typeof b.value === 'string') {
         return parseFloat(b.value) - parseFloat(a.value)
      }
      return (b.value as number) - (a.value as number)
    })

    // 4. 添加 Rank
    return formattedResults.map((item, index) => ({
      rank: index + 1,
      userId: item.userId,
      name: item.name,
      avatar: item.avatar,
      value: item.value
    }))
  }

  private static async getOverallData(roomId: string) {
    return prisma.$queryRaw<any[]>`
      SELECT 
        rp.user_id as "userId",
        p.nickname as name,
        p.avatar_url as avatar,
        COUNT(t.id)::int as value_count
      FROM public.room_participants rp
      JOIN public.profiles p ON rp.user_id = p.id
      LEFT JOIN public.territories t ON t.owner_id = rp.user_id
      WHERE rp.room_id = ${roomId}::uuid
      GROUP BY rp.user_id, p.nickname, p.avatar_url
    `
  }

  private static async getRivalsData(roomId: string) {
    return prisma.$queryRaw<any[]>`
      WITH participants AS (
        SELECT user_id FROM public.room_participants WHERE room_id = ${roomId}::uuid
      ),
      interactions AS (
        SELECT user_id as person FROM public.territory_events 
        WHERE created_at >= NOW() - INTERVAL '24 hours' 
          AND old_owner_id IN (SELECT user_id FROM participants) 
          AND user_id IN (SELECT user_id FROM participants)
        UNION ALL
        SELECT old_owner_id as person FROM public.territory_events 
        WHERE created_at >= NOW() - INTERVAL '24 hours' 
          AND user_id IN (SELECT user_id FROM participants) 
          AND old_owner_id IN (SELECT user_id FROM participants)
      )
      SELECT 
        rp.user_id as "userId",
        p.nickname as name,
        p.avatar_url as avatar,
        COUNT(i.person)::int as value_count
      FROM public.room_participants rp
      JOIN public.profiles p ON rp.user_id = p.id
      LEFT JOIN interactions i ON i.person = rp.user_id
      WHERE rp.room_id = ${roomId}::uuid
      GROUP BY rp.user_id, p.nickname, p.avatar_url
    `
  }

  private static async getStealersData(roomId: string) {
    return prisma.$queryRaw<any[]>`
      SELECT 
        rp.user_id as "userId",
        p.nickname as name,
        p.avatar_url as avatar,
        COUNT(distinct e.territory_id)::int as value_count
      FROM public.room_participants rp
      JOIN public.profiles p ON rp.user_id = p.id
      LEFT JOIN public.territory_events e ON e.new_owner_id = rp.user_id
      WHERE rp.room_id = ${roomId}::uuid
        AND e.event_type = 'OWNER_CHANGED'
        AND e.created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY rp.user_id, p.nickname, p.avatar_url
    `
  }

  private static async getGrowthData(roomId: string) {
    return prisma.$queryRaw<any[]>`
      WITH participants AS (
        SELECT user_id FROM public.room_participants WHERE room_id = ${roomId}::uuid
      ),
      gains AS (
        SELECT new_owner_id as user_id, COUNT(distinct territory_id)::int as g
        FROM public.territory_events
        WHERE event_type = 'OWNER_CHANGED' 
          AND created_at >= NOW() - INTERVAL '24 hours' 
          AND new_owner_id IN (SELECT user_id FROM participants)
        GROUP BY new_owner_id
      ),
      created AS (
        SELECT user_id, COUNT(distinct territory_id)::int as c
        FROM public.territory_events
        WHERE event_type = 'CREATED' 
          AND created_at >= NOW() - INTERVAL '24 hours' 
          AND user_id IN (SELECT user_id FROM participants)
        GROUP BY user_id
      ),
      losses AS (
        SELECT old_owner_id as user_id, COUNT(distinct territory_id)::int as l
        FROM public.territory_events
        WHERE event_type = 'OWNER_CHANGED' 
          AND created_at >= NOW() - INTERVAL '24 hours' 
          AND old_owner_id IN (SELECT user_id FROM participants)
        GROUP BY old_owner_id
      )
      SELECT 
        rp.user_id as "userId",
        p.nickname as name,
        p.avatar_url as avatar,
        (COALESCE(g.g, 0) + COALESCE(c.c, 0) - COALESCE(l.l, 0))::int as value_count
      FROM public.room_participants rp
      JOIN public.profiles p ON rp.user_id = p.id
      LEFT JOIN gains g ON rp.user_id = g.user_id
      LEFT JOIN created c ON rp.user_id = c.user_id
      LEFT JOIN losses l ON rp.user_id = l.user_id
      WHERE rp.room_id = ${roomId}::uuid
    `
  }
}
