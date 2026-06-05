export const SEED_DEFAULT_MISSIONS = [
  {
    id: 'daily_run_1',
    title: '每日开跑',
    description: '完成一次距离大于1公里的跑步',
    type: 'DISTANCE',
    target: 1000,
    reward_coins: 10,
    reward_experience: 50,
    frequency: 'daily'
  },
  {
    id: 'daily_dist_3',
    title: '每日3公里',
    description: '单日累计跑步距离达到3公里',
    type: 'DISTANCE',
    target: 3000,
    reward_coins: 30,
    reward_experience: 100,
    frequency: 'daily'
  },
  {
    id: 'daily_hex_10',
    title: '领地扩张',
    description: '单日占领或访问10个地块',
    type: 'HEX_COUNT',
    target: 10,
    reward_coins: 20,
    reward_experience: 80,
    frequency: 'daily'
  },
  {
    id: 'weekly_dist_15',
    title: '周跑者',
    description: '本周累计跑步15公里',
    type: 'DISTANCE',
    target: 15000,
    reward_coins: 100,
    reward_experience: 800,
    frequency: 'weekly'
  },
  {
    id: 'weekly_run_5',
    title: '坚持不懈',
    description: '本周累计完成5次跑步',
    type: 'RUN_COUNT',
    target: 5,
    reward_coins: 80,
    reward_experience: 600,
    frequency: 'weekly'
  },
  {
    id: 'weekly_explorer_20',
    title: '城市探险',
    description: '本周探索20个新地块',
    type: 'UNIQUE_HEX',
    target: 20,
    reward_coins: 150,
    reward_experience: 700,
    frequency: 'weekly'
  },
  {
    id: 'weekly_night_3',
    title: '夜跑侠',
    description: '本周完成3次夜跑（22:00-04:00）',
    type: 'NIGHT_RUN',
    target: 3,
    reward_coins: 80,
    reward_experience: 400,
    frequency: 'weekly'
  },
  {
    id: 'weekly_active_3',
    title: '活跃跑者',
    description: '本周累计跑步3天',
    type: 'ACTIVE_DAYS',
    target: 3,
    reward_coins: 50,
    reward_experience: 300,
    frequency: 'weekly'
  },
  {
    id: 'weekly_hex_50',
    title: '领地大亨',
    description: '本周占领或访问50个地块',
    type: 'HEX_COUNT',
    target: 50,
    reward_coins: 150,
    reward_experience: 600,
    frequency: 'weekly'
  },
  {
    id: 'weekly_calories_1000',
    title: '燃烧吧卡路里',
    description: '本周累计消耗1000千卡',
    type: 'CALORIES',
    target: 1000,
    reward_coins: 120,
    reward_experience: 500,
    frequency: 'weekly'
  },
  {
    id: 'ach_first_run',
    title: '初次启程',
    description: '完成你的第一次跑步',
    type: 'RUN_COUNT',
    target: 1,
    reward_coins: 50,
    reward_experience: 200,
    frequency: 'achievement'
  },
  {
    id: 'ach_marathon',
    title: '累计马拉松',
    description: '累计跑步距离达到42.195公里',
    type: 'DISTANCE',
    target: 42195,
    reward_coins: 500,
    reward_experience: 2000,
    frequency: 'achievement'
  },
  {
    id: 'ach_landlord',
    title: '大地主',
    description: '累计拥有100个地块',
    type: 'HEX_TOTAL',
    target: 100,
    reward_coins: 1000,
    reward_experience: 5000,
    frequency: 'achievement'
  }
] as const
