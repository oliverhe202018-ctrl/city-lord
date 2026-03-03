// ==================== Game Home v1 Data Contract ====================

/** 跑步模式 */
export type RunMode = 'claim' | 'defend' | 'attack';

/** 目标类型 */
export type TargetType = 'attack' | 'defend' | 'claim' | 'hotspot';

/** 事件类型 */
export type BattleEventType = 'lost' | 'win' | 'defend' | 'share';

/** 事件 CTA 类型 */
export type BattleCtaType = 'counter' | 'see' | 'share';

/** 事件严重程度 */
export type BattleSeverity = 'info' | 'warn';

/** 风险等级 */
export type RiskLevel = 'low' | 'med' | 'high';

// ==================== Sub-types ====================

export interface Target {
    id: string;
    type: TargetType;
    title: string;
    distanceMeters: number;
    rewardEstimate: string;      // e.g. "+18 分 / +6 币"
    riskLevel: RiskLevel;
    riskLabel: string;           // e.g. "对方强度高"
    lat: number;
    lng: number;
    expiresAt?: string;          // ISO date
}

export interface BattleEvent {
    id: string;
    type: BattleEventType;
    text: string;
    createdAt: string;           // ISO date
    relatedTargetId?: string;
    ctaType: BattleCtaType;
    ctaLabel: string;            // e.g. "反击" / "查看" / "炫耀"
    severity: BattleSeverity;
}

export interface ProgressItem {
    key: string;
    label: string;
    current: number;
    total: number;
    remaining: number;           // total - current convenience field
    icon: string;                // lucide icon name
    ctaLabel?: string;           // e.g. "领取" / "去完成"
}

export interface RankItem {
    rank: number;
    name: string;
    score: number;
    avatar?: string;
    isMe: boolean;
    gapToTarget?: number;        // 与上一名的差距
}

export interface ClubEvent {
    id: string;
    memberName: string;
    text: string;
    createdAt: string;           // ISO date
}

export interface HomeHero {
    modeDefault: RunMode;
    todayRewardLeft: number;     // e.g. 80
    todayRewardTotal: number;    // e.g. 100
    cooldownHint: string | null; // null = 无冷却
    estimatedCoverage: number;   // 预计可覆盖格数
}

export interface HomeLocation {
    cityId: string;
    cityName: string;
    countyName?: string;
    lat: number | null;
    lng: number | null;
    accuracy: number | null;
    updatedAt: string;
}

// ==================== Aggregated Response ====================

export interface HomeSummaryData {
    location: HomeLocation;
    hero: HomeHero;
    nearbyTargets: Target[];
    battleFeed: BattleEvent[];
    dailyProgress: ProgressItem[];
    leaderboardMini: RankItem[];
    myRank: RankItem | null;
    clubMini: ClubEvent[];
}
