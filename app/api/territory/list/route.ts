// app/api/territory/list/route.ts

// 👇 1. 添加这一行，强制声明为动态路由
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ⚡️ 核心优化 1：设置 1 分钟的边缘缓存 (CDN)
// 地块信息不需要毫秒级实时，缓存能极大减轻数据库压力
export const revalidate = 60 

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const cityId = searchParams.get('cityId')
    
    if (!cityId) {
      return NextResponse.json({ error: 'cityId required' }, { status: 400 })
    }
    
    // ⚡️ 核心优化 2：只取地图渲染需要的字段
    // 坚决不取 'geojson' 字段，除非你需要画边界（如果只是画点或着色，不要取它）
    // 如果必须画边界，请考虑简化 geometry 或者只在用户点击具体地块时再单独请求详情
    const territories = await prisma.territories.findMany({
      where: {
        city_id: cityId,
        status: 'active'
      },
      select: {
        id: true,
        owner_id: true,
        level: true,
        health: true,
        // captured_at: true, // 根据前端需要决定是否取
        // 注意：这里故意不选 geojson，如果你是基于 H3 渲染的，只取 h3_index 即可
        h3_index: true, 
        profiles: { // 关联查询所有者信息
            select: {
                nickname: true,
                avatar_url: true,
                faction: true
            }
        }
      }
    })
    
    return NextResponse.json(territories)
  } catch (error: any) {
    console.error('Fetch territories error:', error)
    return NextResponse.json([], { status: 200 })
  }
}