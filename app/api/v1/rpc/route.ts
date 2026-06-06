import { NextResponse } from 'next/server'

import * as accountActions from '@/app/actions/account'
import * as achievementActions from '@/app/actions/achievement'
import * as activitiesActions from '@/app/actions/activities'
import * as adminauthActions from '@/app/actions/admin-auth'
import * as adminActions from '@/app/actions/admin'
import * as authcheckActions from '@/app/actions/auth-check'
import * as authActions from '@/app/actions/auth'
import * as badgeactionsActions from '@/app/actions/badge.actions'
import * as badgeActions from '@/app/actions/badge'
import * as challengeserviceActions from '@/app/actions/challenge-service'
import * as checkachievementsActions from '@/app/actions/check-achievements'
import * as cityActions from '@/app/actions/city'
import * as clubactivityactionsActions from '@/app/actions/club-activity.actions'
import * as clubchatactionsActions from '@/app/actions/club-chat.actions'
import * as clubdynamicsactionsActions from '@/app/actions/club-dynamics.actions'
import * as clubserviceActions from '@/app/actions/club-service'
import * as clubActions from '@/app/actions/club'
import * as factionActions from '@/app/actions/faction'
import * as leaderboardActions from '@/app/actions/leaderboard'
import * as messageActions from '@/app/actions/message'
import * as missionActions from '@/app/actions/mission'
import * as notificationActions from '@/app/actions/notification'
import * as profileActions from '@/app/actions/profile'
import * as redemptionActions from '@/app/actions/redemption'
import * as referralActions from '@/app/actions/referral'
import * as reportActions from '@/app/actions/report'
import * as roomActions from '@/app/actions/room'
import * as runserviceActions from '@/app/actions/run-service'
import * as seedActions from '@/app/actions/seed'
import * as smsauthActions from '@/app/actions/sms-auth'
import * as socialhubActions from '@/app/actions/social-hub'
import * as socialserviceActions from '@/app/actions/social-service'
import * as socialActions from '@/app/actions/social'
import * as storeserviceActions from '@/app/actions/store-service'
import * as storeActions from '@/app/actions/store'
import * as storyserviceActions from '@/app/actions/story-service'
import * as syncActions from '@/app/actions/sync'
import * as territorydetailActions from '@/app/actions/territory-detail'
import * as territoryrenameActions from '@/app/actions/territory-rename'
import * as territoryreportActions from '@/app/actions/territory-report'
import * as userinvitationsActions from '@/app/actions/user-invitations'
import * as userActions from '@/app/actions/user'
import * as voicetranscribeActions from '@/app/actions/voice-transcribe'
import * as watchsyncActions from '@/app/actions/watch-sync'
import * as adminbackgroundsActions from '@/app/actions/admin/backgrounds'
import * as adminchangelogactionsActions from '@/app/actions/admin/changelog-actions'
import * as adminfeedbackActions from '@/app/actions/admin/feedback'
import * as admingetfeedbackActions from '@/app/actions/admin/get-feedback'
import * as adminstoreitemsActions from '@/app/actions/admin/store-items'
import * as adminterritoriesActions from '@/app/actions/admin/territories'
import * as changeloggetchangelogsActions from '@/app/actions/changelog/get-changelogs'
import * as changelogunreadactionsActions from '@/app/actions/changelog/unread-actions'

// Aggregate all Action modules
const modules: Record<string, any> = {
  'account': accountActions,
  'achievement': achievementActions,
  'activities': activitiesActions,
  'admin-auth': adminauthActions,
  'admin': adminActions,
  'auth-check': authcheckActions,
  'auth': authActions,
  'badge.actions': badgeactionsActions,
  'badge': badgeActions,
  'challenge-service': challengeserviceActions,
  'check-achievements': checkachievementsActions,
  'city': cityActions,
  'club-activity.actions': clubactivityactionsActions,
  'club-chat.actions': clubchatactionsActions,
  'club-dynamics.actions': clubdynamicsactionsActions,
  'club-service': clubserviceActions,
  'club': clubActions,
  'faction': factionActions,
  'leaderboard': leaderboardActions,
  'message': messageActions,
  'mission': missionActions,
  'notification': notificationActions,
  'profile': profileActions,
  'redemption': redemptionActions,
  'referral': referralActions,
  'report': reportActions,
  'room': roomActions,
  'run-service': runserviceActions,
  'seed': seedActions,
  'sms-auth': smsauthActions,
  'social-hub': socialhubActions,
  'social-service': socialserviceActions,
  'social': socialActions,
  'store-service': storeserviceActions,
  'store': storeActions,
  'story-service': storyserviceActions,
  'sync': syncActions,
  'territory-detail': territorydetailActions,
  'territory-rename': territoryrenameActions,
  'territory-report': territoryreportActions,
  'user-invitations': userinvitationsActions,
  'user': userActions,
  'voice-transcribe': voicetranscribeActions,
  'watch-sync': watchsyncActions,
  'admin/backgrounds': adminbackgroundsActions,
  'admin/changelog-actions': adminchangelogactionsActions,
  'admin/feedback': adminfeedbackActions,
  'admin/get-feedback': admingetfeedbackActions,
  'admin/store-items': adminstoreitemsActions,
  'admin/territories': adminterritoriesActions,
  'changelog/get-changelogs': changeloggetchangelogsActions,
  'changelog/unread-actions': changelogunreadactionsActions
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
      return NextResponse.json({ success: false, error: '未找到模块: ' + module }, { status: 404 })
    }

    const targetFunction = targetModule[action]
    if (!targetFunction || typeof targetFunction !== 'function') {
      return NextResponse.json({ success: false, error: '在模块 ' + module + ' 中未找到方法: ' + action }, { status: 404 })
    }

    const finalArgs = [...args, token]
    console.log([RPC] Executing $module.$action with $args.length args)
    
    const result = await targetFunction(...finalArgs)
    return NextResponse.json({ success: true, data: result })

  } catch (error: any) {
    console.error([RPC Error], error)
    return NextResponse.json(
      { success: false, error: error.message || '内部服务器错误' },
      { status: 500 }
    )
  }
}
