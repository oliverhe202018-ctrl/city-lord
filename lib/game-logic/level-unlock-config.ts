export type FeatureId =
  | 'running'
  | 'territory_capture'
  | 'create_club'
  | 'join_club'
  | 'challenge'
  | 'room'
  | 'territory_attack'
  | 'store_purchase'
  | 'friend_invite'
  | 'route_plan'
  | 'training_plan'
  | 'social_feed'
  | 'message'
  | 'achievement_claim'

export interface FeatureUnlockConfig {
  featureId: FeatureId
  requiredLevel: number
  title: string
  description: string
}

const FEATURES: FeatureUnlockConfig[] = [
  {
    featureId: 'running',
    requiredLevel: 1,
    title: '跑步',
    description: '基础跑步功能',
  },
  {
    featureId: 'territory_capture',
    requiredLevel: 1,
    title: '领地占领',
    description: '通过跑步路径围合领地',
  },
  {
    featureId: 'achievement_claim',
    requiredLevel: 1,
    title: '成就领取',
    description: '查看和领取成就奖励',
  },
  {
    featureId: 'store_purchase',
    requiredLevel: 2,
    title: '商店购买',
    description: '使用金币在商店购买道具',
  },
  {
    featureId: 'join_club',
    requiredLevel: 3,
    title: '加入俱乐部',
    description: '搜索并加入俱乐部',
  },
  {
    featureId: 'friend_invite',
    requiredLevel: 4,
    title: '好友邀请',
    description: '发送好友邀请并邀请码',
  },
  {
    featureId: 'create_club',
    requiredLevel: 5,
    title: '创建俱乐部',
    description: '创建并管理自己的俱乐部',
  },
  {
    featureId: 'territory_attack',
    requiredLevel: 6,
    title: '领地进攻',
    description: '攻击他人的领地',
  },
  {
    featureId: 'route_plan',
    requiredLevel: 7,
    title: '路线规划',
    description: '规划和保存跑步路线',
  },
  {
    featureId: 'challenge',
    requiredLevel: 8,
    title: '挑战系统',
    description: '向其他用户发起挑战',
  },
  {
    featureId: 'room',
    requiredLevel: 10,
    title: '房间系统',
    description: '创建或加入多人跑步房间',
  },
  {
    featureId: 'training_plan',
    requiredLevel: 12,
    title: '训练计划',
    description: '创建和管理训练计划',
  },
  {
    featureId: 'social_feed',
    requiredLevel: 1,
    title: '社交动态',
    description: '浏览和发布社交动态',
  },
  {
    featureId: 'message',
    requiredLevel: 1,
    title: '消息系统',
    description: '发送和接收私信',
  },
]

export const FEATURE_UNLOCK_MAP: Readonly<Record<FeatureId, number>> = Object.fromEntries(
  FEATURES.map((f) => [f.featureId, f.requiredLevel])
) as Readonly<Record<FeatureId, number>>

export const ALL_FEATURES: ReadonlyArray<FeatureUnlockConfig> = FEATURES

export function getFeatureById(featureId: string): FeatureUnlockConfig | undefined {
  return FEATURES.find((f) => f.featureId === featureId)
}

export function getLockedFeatures(userLevel: number): FeatureUnlockConfig[] {
  return FEATURES.filter((f) => userLevel < f.requiredLevel)
}

export function getUnlockedFeatures(userLevel: number): FeatureUnlockConfig[] {
  return FEATURES.filter((f) => userLevel >= f.requiredLevel)
}
