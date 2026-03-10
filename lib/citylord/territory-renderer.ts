import { ExtTerritory, ViewContext, TerritoryRelation, TerritoryRenderStyle, TerritorySubject } from "@/types/city"

// string to color hash for individual enemies
const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00ffffff).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
}

// Helper to convert hex to rgb string 'r, g, b' for rgba
const hexToRgbStr = (hex: string) => {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `${r}, ${g}, ${b}`;
}

/**
 * 动态计算地块归属关系
 */
export function getTerritoryRelation(t: ExtTerritory, ctx: ViewContext): TerritoryRelation {
    // 如果没有 ownerId，则肯定是 neutral
    if (!t.ownerId) return 'neutral';

    if (ctx.subject === 'club') {
        if (ctx.clubId && t.ownerClubId === ctx.clubId) return 'self';
        if (t.ownerClubId && t.ownerClubId !== ctx.clubId) return 'enemy';
        // 缺乏俱乐部信息，安全降级为个人视角判断
        return (ctx.userId && t.ownerId === ctx.userId) ? 'self' : 'enemy';
    }

    if (ctx.subject === 'faction') {
        if (ctx.faction && t.ownerFaction === ctx.faction) return 'self';
        if (t.ownerFaction && t.ownerFaction !== ctx.faction) return 'enemy';
        // 缺乏阵营信息，安全降级为个人视角判断
        return (ctx.userId && t.ownerId === ctx.userId) ? 'self' : 'enemy';
    }

    // individual fallback
    if (ctx.userId && t.ownerId === ctx.userId) return 'self';
    return 'enemy';
}

/**
 * 计算未沾染战损的基础阵营颜色
 */
export function getBaseColor(relation: TerritoryRelation, ownerId: string, subject: TerritorySubject): string {
    if (relation === 'self') return '#22c55e'; // 绿色基调
    if (relation === 'neutral') return '#3f3f46'; // 中立灰调

    // 对于 enemy
    if (subject === 'individual') {
        return ownerId ? stringToColor(ownerId) : '#a855f7';
    }

    // club/faction 统一样式警示色
    return '#ef4444';
}

function adjustColorForHealth(hexColor: string, healthRatio: number, type: 'top' | 'side' | 'fill'): string {
    // 将原色转换为 rgb
    let r = 0, g = 0, b = 0;
    hexColor = hexColor.replace('#', '');
    if (hexColor.length === 3) hexColor = hexColor.split('').map(c => c + c).join('');
    r = parseInt(hexColor.substring(0, 2), 16);
    g = parseInt(hexColor.substring(2, 4), 16);
    b = parseInt(hexColor.substring(4, 6), 16);

    // 战损混合：不再强制向暗红泥色收敛，改为向暗色降低亮度和饱和度，保持原始阵营色相
    const mixRatio = 1.0 - healthRatio;

    // 暗色目标（深灰）
    const targetR = 40, targetG = 40, targetB = 40;

    // 限制最大混色比为 60%，无论多残血都至少保留 40% 的原始色相
    const intensity = mixRatio * 0.6;

    let outR = Math.round(r * (1 - intensity) + targetR * intensity);
    let outG = Math.round(g * (1 - intensity) + targetG * intensity);
    let outB = Math.round(b * (1 - intensity) + targetB * intensity);

    if (type === 'side') {
        return `rgba(${outR}, ${outG}, ${outB}, 0.6)`;
    } else if (type === 'top') {
        return `rgb(${Math.round(outR * 0.8)}, ${Math.round(outG * 0.8)}, ${Math.round(outB * 0.8)})`;
    } else {
        // fillColor2D
        return `rgba(${outR}, ${outG}, ${outB}, 0.5)`;
    }
}

/**
 * 按照健康状态衰减或混合视觉状态
 */
export function calculateHealthVisuals(baseColor: string, health: number, maxHealth: number = 1000) {
    const healthRatio = Math.max(0, Math.min(1, health / maxHealth));

    const sideColor = adjustColorForHealth(baseColor, healthRatio, 'side');
    const topColor = adjustColorForHealth(baseColor, healthRatio, 'top');
    const fillColor2D = adjustColorForHealth(baseColor, healthRatio, 'fill');

    const isDamaged = healthRatio < 0.8;
    const isCritical = healthRatio < 0.4;

    // 避免健康清零后高度消失导致不可见，提供0.3保底值
    const heightScale = 0.3 + 0.7 * healthRatio;

    return { sideColor, topColor, fillColor2D, heightScale, isDamaged, isCritical };
}

/**
 * 统览主入口方法，输出 Style
 */
export function generateTerritoryStyle(t: ExtTerritory, ctx: ViewContext): TerritoryRenderStyle {
    const relation = getTerritoryRelation(t, ctx);
    const baseHexColor = getBaseColor(relation, t.ownerId || '', ctx.subject);

    const maxHealth = t.maxHealth ?? 1000;
    const health = t.health ?? maxHealth;

    const visuals = calculateHealthVisuals(baseHexColor, health, maxHealth);

    return {
        relation,
        subject: ctx.subject,
        baseColor: `rgba(${hexToRgbStr(baseHexColor)}, 0.6)`,
        topColor: visuals.topColor,
        sideColor: visuals.sideColor,
        fillColor2D: visuals.fillColor2D,
        strokeColor2D: baseHexColor,
        heightScale: visuals.heightScale,
        isDamaged: visuals.isDamaged,
        isCritical: visuals.isCritical
    };
}

/**
 * 纯中立空白地块默认渲染包装分配
 */
export function generateNeutralTerritoryStyle(ctx: ViewContext): TerritoryRenderStyle {
    const baseHexColor = getBaseColor('neutral', '', ctx.subject);
    const maxHealth = 1000;
    const health = maxHealth;

    const visuals = calculateHealthVisuals(baseHexColor, health, maxHealth);

    return {
        relation: 'neutral',
        subject: ctx.subject,
        baseColor: `rgba(${hexToRgbStr(baseHexColor)}, 0.6)`,
        topColor: visuals.topColor,
        sideColor: visuals.sideColor,
        fillColor2D: visuals.fillColor2D,
        strokeColor2D: baseHexColor,
        heightScale: visuals.heightScale,
        isDamaged: visuals.isDamaged,
        isCritical: visuals.isCritical
    };
}
