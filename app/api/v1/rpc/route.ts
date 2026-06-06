import { NextResponse } from 'next/server'
import * as profileActions from '@/app/actions/profile'
import * as userActions from '@/app/actions/user'

import * as clubActions from '@/app/actions/club'
import * as runActions from '@/app/actions/run-service'
import * as socialActions from '@/app/actions/social'
import * as socialHubActions from '@/app/actions/social-hub'
import * as storeActions from '@/app/actions/store-service'
import * as missionActions from '@/app/actions/mission'
import * as territoryActions from '@/app/actions/territory-detail'
import * as leaderboardActions from '@/app/actions/leaderboard'
import * as accountActions from '@/app/actions/account'
import * as achievementActions from '@/app/actions/achievement'

// 聚合所有已重构的 Action 模块
const modules: Record<string, any> = {
  profile: profileActions,
  user: userActions,
  club: clubActions,
  run: runActions,
  social: socialActions,
  socialHub: socialHubActions,
  store: storeActions,
  mission: missionActions,
  territory: territoryActions,
  leaderboard: leaderboardActions,
  account: accountActions,
  achievement: achievementActions
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : undefined

    const body = await request.json()
    const { module, action, args = [] } = body

    if (!module || !action) {
      return NextResponse.json({ success: false, error: '缺少 module 或 action 参数' }, { status: 400 })
    }

    const targetModule = modules[module]
    if (!targetModule) {
      return NextResponse.json({ success: false, error: `未找到模块: ${module}` }, { status: 404 })
    }

    const targetFunction = targetModule[action]
    if (!targetFunction || typeof targetFunction !== 'function') {
      return NextResponse.json({ success: false, error: `在模块 ${module} 中未找到方法: ${action}` }, { status: 404 })
    }

    // 将 token 作为最后一个参数注入（适用于我们重构后的 Action 签名）
    // 我们的约定是：Action 最后一个参数是 token?: string
    // 因此如果 args 是 [userId], 那么调用就是 targetFunction(userId, token)
    const finalArgs = [...args, token]

    console.log(`[RPC] Executing ${module}.${action} with ${args.length} args`)
    
    // 执行 Action
    const result = await targetFunction(...finalArgs)

    return NextResponse.json({ success: true, data: result })

  } catch (error: any) {
    console.error(`[RPC Error]`, error)
    return NextResponse.json(
      { success: false, error: error.message || '内部服务器错误' },
      { status: 500 }
    )
  }
}
