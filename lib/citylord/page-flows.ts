// ============================================================
// CityLord Page Flow Definitions
// Interactive flow diagrams and page relationships
// ============================================================

// Page/Screen type definitions
export interface FlowNode {
  id: string
  name: string
  nameEn: string
  type: "screen" | "modal" | "popup" | "action"
  description: string
  component?: string
}

export interface FlowEdge {
  from: string
  to: string
  trigger: string
  condition?: string
  action?: string
}

export interface FlowDiagram {
  id: string
  name: string
  description: string
  nodes: FlowNode[]
  edges: FlowEdge[]
}

// ============================================================
// Flow 1: 启动页 → 新手引导 → 跑步主界面
// ============================================================

export const onboardingFlow: FlowDiagram = {
  id: "onboarding-flow",
  name: "新用户引导流程",
  description: "从启动到主界面的完整引导路径",
  nodes: [
    {
      id: "splash",
      name: "启动页",
      nameEn: "Splash Screen",
      type: "screen",
      description: "应用启动时显示的品牌页面",
      component: "SplashScreen",
    },
    {
      id: "welcome",
      name: "欢迎浮层",
      nameEn: "Welcome Modal",
      type: "modal",
      description: "首次登录的欢迎介绍",
      component: "WelcomeScreen",
    },
    {
      id: "tutorial-start",
      name: "教程-开始跑步",
      nameEn: "Tutorial - Start Run",
      type: "popup",
      description: "引导用户点击开始跑步按钮",
      component: "InteractiveTutorial",
    },
    {
      id: "tutorial-map",
      name: "教程-地图说明",
      nameEn: "Tutorial - Map Guide",
      type: "popup",
      description: "解释六边形地图的含义",
      component: "InteractiveTutorial",
    },
    {
      id: "tutorial-goal",
      name: "教程-每日目标",
      nameEn: "Tutorial - Daily Goal",
      type: "popup",
      description: "介绍每日目标卡片",
      component: "InteractiveTutorial",
    },
    {
      id: "tutorial-nav",
      name: "教程-快速导航",
      nameEn: "Tutorial - Navigation",
      type: "popup",
      description: "介绍底部导航栏功能",
      component: "QuickNavPopup",
    },
    {
      id: "main-map",
      name: "跑步主界面",
      nameEn: "Main Map Screen",
      type: "screen",
      description: "主地图界面，显示六边形网格和跑步按钮",
      component: "CityLordApp (map tab)",
    },
  ],
  edges: [
    {
      from: "splash",
      to: "welcome",
      trigger: "自动过渡",
      condition: "isFirstVisit === true",
      action: "显示欢迎浮层",
    },
    {
      from: "splash",
      to: "main-map",
      trigger: "自动过渡",
      condition: "isFirstVisit === false",
      action: "直接进入主界面",
    },
    {
      from: "welcome",
      to: "tutorial-start",
      trigger: "点击「开始冒险」",
      action: "开始交互式教程",
    },
    {
      from: "welcome",
      to: "main-map",
      trigger: "点击「跳过」",
      action: "跳过教程直接进入",
    },
    {
      from: "tutorial-start",
      to: "tutorial-map",
      trigger: "点击「下一步」",
      action: "切换到地图教程",
    },
    {
      from: "tutorial-map",
      to: "tutorial-goal",
      trigger: "点击「下一步」",
      action: "切换到目标教程",
    },
    {
      from: "tutorial-goal",
      to: "tutorial-nav",
      trigger: "点击「下一步」",
      action: "切换到导航教程",
    },
    {
      from: "tutorial-nav",
      to: "main-map",
      trigger: "点击「完成教程」",
      action: "教程完成，进入主界面",
    },
  ],
}

// ============================================================
// Flow 2: 跑步中 → 被抢占提示 → 反击目标页
// ============================================================

export const territoryBattleFlow: FlowDiagram = {
  id: "territory-battle-flow",
  name: "领地争夺流程",
  description: "跑步中收到领地被抢占通知并反击的流程",
  nodes: [
    {
      id: "running",
      name: "跑步中",
      nameEn: "Running State",
      type: "screen",
      description: "用户正在跑步，显示实时数据",
      component: "RunningStatusBar + HexGridOverlay",
    },
    {
      id: "territory-alert",
      name: "领地被抢占弹窗",
      nameEn: "Territory Alert Popup",
      type: "popup",
      description: "通知用户某个领地被其他玩家抢占",
      component: "TerritoryAlert",
    },
    {
      id: "counter-attack",
      name: "反击目标页",
      nameEn: "Counter Attack Screen",
      type: "screen",
      description: "显示被抢占的领地位置，引导用户前往",
      component: "HexGridOverlay (with target highlight)",
    },
    {
      id: "battle-progress",
      name: "夺回进度",
      nameEn: "Recapture Progress",
      type: "popup",
      description: "显示夺回领地的进度",
      component: "HexCaptureEffect",
    },
    {
      id: "battle-result",
      name: "战斗结果",
      nameEn: "Battle Result",
      type: "modal",
      description: "显示战斗胜利或失败的结果",
      component: "AchievementPopup (battle variant)",
    },
    {
      id: "dismiss",
      name: "忽略",
      nameEn: "Dismiss",
      type: "action",
      description: "用户选择忽略此次抢占通知",
    },
  ],
  edges: [
    {
      from: "running",
      to: "territory-alert",
      trigger: "收到WebSocket推送",
      condition: "用户领地被其他玩家占领",
      action: "显示抢占提醒弹窗",
    },
    {
      from: "territory-alert",
      to: "counter-attack",
      trigger: "点击「立即反击」",
      action: "在地图上高亮目标领地",
    },
    {
      from: "territory-alert",
      to: "running",
      trigger: "点击「查看地图」",
      action: "关闭弹窗，在地图显示被占领地",
    },
    {
      from: "territory-alert",
      to: "dismiss",
      trigger: "点击关闭或超时",
      action: "关闭弹窗，继续当前活动",
    },
    {
      from: "counter-attack",
      to: "battle-progress",
      trigger: "用户跑到目标领地",
      condition: "GPS检测到用户进入目标区域",
      action: "开始夺回进度",
    },
    {
      from: "battle-progress",
      to: "battle-result",
      trigger: "夺回完成",
      condition: "用户在区域停留足够时间",
      action: "显示战斗结果",
    },
    {
      from: "battle-result",
      to: "running",
      trigger: "点击「继续跑步」",
      action: "返回跑步状态",
    },
  ],
}

// ============================================================
// Flow 3: 任务页 → 任务详情 → 领取奖励 → 任务完成反馈
// ============================================================

export const missionFlow: FlowDiagram = {
  id: "mission-flow",
  name: "任务系统流程",
  description: "从查看任务到领取奖励的完整流程",
  nodes: [
    {
      id: "mission-list",
      name: "任务列表",
      nameEn: "Mission List",
      type: "screen",
      description: "显示所有可用任务，按类型分组",
      component: "MissionList",
    },
    {
      id: "mission-detail",
      name: "任务详情",
      nameEn: "Mission Detail",
      type: "modal",
      description: "显示单个任务的详细信息和进度",
      component: "MissionCard (expanded)",
    },
    {
      id: "claim-reward",
      name: "领取奖励",
      nameEn: "Claim Reward",
      type: "action",
      description: "用户点击领取已完成任务的奖励",
    },
    {
      id: "reward-animation",
      name: "奖励动画",
      nameEn: "Reward Animation",
      type: "popup",
      description: "播放奖励领取的视觉反馈",
      component: "AnimatedButton (success state)",
    },
    {
      id: "completion-popup",
      name: "任务完成弹窗",
      nameEn: "Completion Popup",
      type: "modal",
      description: "显示任务完成的详细信息和获得的奖励",
      component: "AchievementPopup (mission variant)",
    },
    {
      id: "next-mission",
      name: "下一个任务推荐",
      nameEn: "Next Mission Suggestion",
      type: "popup",
      description: "推荐用户下一个可以完成的任务",
    },
  ],
  edges: [
    {
      from: "mission-list",
      to: "mission-detail",
      trigger: "点击任务卡片",
      action: "展开任务详情",
    },
    {
      from: "mission-detail",
      to: "mission-list",
      trigger: "点击返回或外部区域",
      action: "收起详情",
    },
    {
      from: "mission-list",
      to: "claim-reward",
      trigger: "点击「领取」按钮",
      condition: "任务状态 === completed",
      action: "触发领取流程",
    },
    {
      from: "mission-detail",
      to: "claim-reward",
      trigger: "点击「领取奖励」",
      condition: "任务状态 === completed",
      action: "触发领取流程",
    },
    {
      from: "claim-reward",
      to: "reward-animation",
      trigger: "领取确认",
      action: "播放按钮成功动画",
    },
    {
      from: "reward-animation",
      to: "completion-popup",
      trigger: "动画完成",
      action: "显示完成弹窗",
    },
    {
      from: "completion-popup",
      to: "next-mission",
      trigger: "点击「继续」",
      condition: "有其他可完成的任务",
      action: "显示下一任务推荐",
    },
    {
      from: "completion-popup",
      to: "mission-list",
      trigger: "点击「继续」",
      condition: "没有其他可完成的任务",
      action: "返回任务列表",
    },
    {
      from: "next-mission",
      to: "mission-detail",
      trigger: "点击推荐任务",
      action: "查看推荐任务详情",
    },
    {
      from: "next-mission",
      to: "mission-list",
      trigger: "点击「稍后」",
      action: "返回任务列表",
    },
  ],
}

// ============================================================
// Flow 4: 好友页 → 发起挑战 → 结果反馈
// ============================================================

export const challengeFlow: FlowDiagram = {
  id: "challenge-flow",
  name: "好友挑战流程",
  description: "从好友列表发起挑战到获取结果的流程",
  nodes: [
    {
      id: "social-hub",
      name: "社交中心",
      nameEn: "Social Hub",
      type: "screen",
      description: "社交功能主页，包含好友列表和动态",
      component: "Social Tab",
    },
    {
      id: "friends-list",
      name: "好友列表",
      nameEn: "Friends List",
      type: "screen",
      description: "显示所有好友及其状态",
      component: "FriendsList",
    },
    {
      id: "friend-profile",
      name: "好友资料",
      nameEn: "Friend Profile",
      type: "modal",
      description: "查看好友详细资料和数据",
      component: "FriendProfile",
    },
    {
      id: "challenge-setup",
      name: "发起挑战",
      nameEn: "Challenge Setup",
      type: "screen",
      description: "选择挑战类型和参数",
      component: "ChallengePage",
    },
    {
      id: "challenge-confirm",
      name: "挑战确认",
      nameEn: "Challenge Confirmation",
      type: "popup",
      description: "确认发送挑战",
    },
    {
      id: "challenge-sent",
      name: "挑战已发送",
      nameEn: "Challenge Sent",
      type: "popup",
      description: "显示挑战发送成功",
      component: "Toast/AnimatedButton",
    },
    {
      id: "waiting-response",
      name: "等待响应",
      nameEn: "Waiting for Response",
      type: "screen",
      description: "等待好友接受或拒绝挑战",
    },
    {
      id: "challenge-accepted",
      name: "挑战开始",
      nameEn: "Challenge Started",
      type: "modal",
      description: "好友接受挑战，比赛开始",
      component: "ChallengeInvite (accepted variant)",
    },
    {
      id: "challenge-declined",
      name: "挑战被拒绝",
      nameEn: "Challenge Declined",
      type: "popup",
      description: "好友拒绝了挑战",
    },
    {
      id: "challenge-active",
      name: "挑战进行中",
      nameEn: "Challenge In Progress",
      type: "screen",
      description: "显示双方实时进度",
      component: "ChallengeProgress",
    },
    {
      id: "challenge-result",
      name: "挑战结果",
      nameEn: "Challenge Result",
      type: "modal",
      description: "显示挑战胜负和奖励",
      component: "ChallengeResult",
    },
  ],
  edges: [
    {
      from: "social-hub",
      to: "friends-list",
      trigger: "已在社交中心",
      action: "显示好友列表",
    },
    {
      from: "friends-list",
      to: "friend-profile",
      trigger: "点击好友头像",
      action: "显示好友详细资料",
    },
    {
      from: "friends-list",
      to: "challenge-setup",
      trigger: "点击「发起挑战」",
      action: "进入挑战设置页",
    },
    {
      from: "friend-profile",
      to: "challenge-setup",
      trigger: "点击「挑战TA」",
      action: "进入挑战设置页",
    },
    {
      from: "challenge-setup",
      to: "challenge-confirm",
      trigger: "点击「发送挑战」",
      condition: "已选择挑战类型",
      action: "显示确认弹窗",
    },
    {
      from: "challenge-confirm",
      to: "challenge-sent",
      trigger: "点击「确认」",
      action: "发送挑战请求",
    },
    {
      from: "challenge-sent",
      to: "waiting-response",
      trigger: "自动过渡",
      action: "等待好友响应",
    },
    {
      from: "waiting-response",
      to: "challenge-accepted",
      trigger: "收到接受通知",
      action: "显示挑战开始",
    },
    {
      from: "waiting-response",
      to: "challenge-declined",
      trigger: "收到拒绝通知",
      action: "显示拒绝提示",
    },
    {
      from: "waiting-response",
      to: "challenge-declined",
      trigger: "超时",
      condition: "超过30秒无响应",
      action: "挑战过期",
    },
    {
      from: "challenge-accepted",
      to: "challenge-active",
      trigger: "点击「开始」",
      action: "进入挑战进行中状态",
    },
    {
      from: "challenge-active",
      to: "challenge-result",
      trigger: "挑战完成",
      condition: "一方达成目标或时间结束",
      action: "显示挑战结果",
    },
    {
      from: "challenge-result",
      to: "social-hub",
      trigger: "点击「完成」",
      action: "返回社交中心",
    },
    {
      from: "challenge-declined",
      to: "friends-list",
      trigger: "点击「好的」",
      action: "返回好友列表",
    },
  ],
}

// ============================================================
// Flow 5: 错误处理与异常反馈流程
// ============================================================

export const errorHandlingFlow: FlowDiagram = {
  id: "error-handling-flow",
  name: "错误处理流程",
  description: "各类错误和异常情况的处理路径",
  nodes: [
    {
      id: "gps-weak",
      name: "GPS信号弱弹窗",
      nameEn: "GPS Weak Popup",
      type: "popup",
      description: "当GPS信号不足时显示的提示",
      component: "GpsWeakPopup",
    },
    {
      id: "network-banner",
      name: "网络断连横幅",
      nameEn: "Network Banner",
      type: "popup",
      description: "网络断开时显示的顶部横幅",
      component: "NetworkBanner",
    },
    {
      id: "permission-prompt",
      name: "定位权限提示",
      nameEn: "Location Permission Prompt",
      type: "modal",
      description: "定位权限未开启时的引导弹窗",
      component: "LocationPermissionPrompt",
    },
    {
      id: "load-failed",
      name: "数据加载失败",
      nameEn: "Data Load Failed",
      type: "popup",
      description: "数据加载失败时的重试卡片",
      component: "DataLoadFailedCard",
    },
    {
      id: "retry-success",
      name: "重试成功",
      nameEn: "Retry Success",
      type: "action",
      description: "重试操作成功后恢复正常状态",
    },
    {
      id: "open-settings",
      name: "打开设置",
      nameEn: "Open Settings",
      type: "action",
      description: "跳转到系统设置页面",
    },
  ],
  edges: [
    {
      from: "gps-weak",
      to: "retry-success",
      trigger: "点击「重新定位」",
      condition: "GPS信号恢复",
      action: "关闭弹窗，继续运行",
    },
    {
      from: "gps-weak",
      to: "gps-weak",
      trigger: "点击「重新定位」",
      condition: "GPS信号仍然弱",
      action: "显示重试中状态",
    },
    {
      from: "network-banner",
      to: "retry-success",
      trigger: "网络恢复或点击重试",
      action: "显示「网络已恢复」后隐藏",
    },
    {
      from: "permission-prompt",
      to: "open-settings",
      trigger: "点击「前往设置开启」",
      action: "跳转到系统定位设置",
    },
    {
      from: "permission-prompt",
      to: "retry-success",
      trigger: "用户开启权限后返回",
      action: "检测到权限，关闭弹窗",
    },
    {
      from: "load-failed",
      to: "retry-success",
      trigger: "点击「重新加载」",
      condition: "加载成功",
      action: "显示正常内容",
    },
  ],
}

// ============================================================
// Export all flows
// ============================================================

export const allFlows = {
  onboarding: onboardingFlow,
  territoryBattle: territoryBattleFlow,
  mission: missionFlow,
  challenge: challengeFlow,
  errorHandling: errorHandlingFlow,
}

// Page relationship summary
export const pageRelationships = {
  mainScreens: [
    { id: "map", name: "地图", component: "HexGridOverlay" },
    { id: "missions", name: "任务", component: "MissionList" },
    { id: "leaderboard", name: "排行榜", component: "Leaderboard" },
    { id: "social", name: "社交", component: "FriendsList + FriendActivityFeed" },
    { id: "profile", name: "个人中心", component: "Profile" },
  ],
  modals: [
    { id: "territory-alert", name: "领地被抢占", trigger: "WebSocket推送" },
    { id: "challenge-invite", name: "挑战邀请", trigger: "好友发起挑战" },
    { id: "achievement", name: "成就解锁", trigger: "达成成就条件" },
    { id: "welcome", name: "欢迎浮层", trigger: "首次登录" },
  ],
  overlays: [
    { id: "onboarding", name: "新手引导", trigger: "首次使用" },
    { id: "theme-switcher", name: "主题切换", trigger: "点击设置" },
    { id: "quick-nav", name: "快速导航", trigger: "教程或长按" },
  ],
}
