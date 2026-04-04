/**
 * AMapLocation Capacitor Plugin — TypeScript 接口声明
 *
 * 主力定位源：Android 高德定位 SDK（原生 GCJ-02 坐标，直接写入 store）。
 * Web 环境降级为 navigator.geolocation + gcoord WGS84→GCJ02。
 */

import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

// ---------------------------------------------------------------------------
// Position payload (从 native 端返回)
// ---------------------------------------------------------------------------

export interface AMapPosition {
    /** 纬度（GCJ-02） */
    lat: number;
    /** 经度（GCJ-02） */
    lng: number;
    /** 定位精度（米） */
    accuracy: number;
    /** 方向角（0-360），无值时为 -1 */
    bearing: number;
    /** 速度（m/s），无值时为 -1 */
    speed: number;
    /** 定位时间戳（ms since epoch） */
    timestamp: number;
    /** 坐标系（AMap 原生固定为 'gcj02'） */
    coordSystem: 'gcj02';
    /**
     * 高德 locationType：
     *  1 = GPS 定位
     *  2 = 前次缓存
     *  4 = 基站缓存
     *  5 = Wifi 定位
     *  6 = 基站定位
     *  8 = 离线定位
     *  9 = 最后已知位置（仅 stopLocation 后）
     */
    locationType: number;
    /** 逆地理编码地址（可选） */
    address?: string;
    /** 定位提供者描述（可选，如 'gps', 'lbs', 'wifi'） */
    provider?: string;
    /** 是否可能为模拟设备或伪造位置信号（反作弊特征） */
    isMock?: boolean;
}

// ---------------------------------------------------------------------------
// Error payload
// ---------------------------------------------------------------------------

export interface AMapLocationError {
    /** 高德错误码 */
    code: number;
    /** 错误描述 */
    message: string;
}

// ---------------------------------------------------------------------------
// Plugin 方法参数
// ---------------------------------------------------------------------------

export interface GetCurrentPositionOptions {
    /**
     * 定位模式：
     * - 'fast'    : 高精度 + 允许短期缓存，用于冷启动快速修正
     * - 'precise' : 高精度 + 不接受缓存，用于手动刷新
     */
    mode: 'fast' | 'precise';
    /** 超时时间（ms），默认 8000 */
    timeout?: number;
    /** 允许接受 SDK 缓存的最大年龄（ms），默认 5000。设为 0 表示不接受缓存 */
    cacheMaxAge?: number;
}

export interface StartWatchOptions {
    /**
     * Watch 模式：
     * - 'browse'  : 低功耗浏览（首页用）, Battery_Saving 策略
     * - 'running' : 高频跑步（跑步页用）, Device_Sensors 策略
     */
    mode: 'browse' | 'running';
    /** 定位间隔（ms），默认 browse=5000, running=1000 */
    interval?: number;
    /** 最小更新距离（m），默认 browse=10, running=3 */
    distanceFilter?: number;
}

export interface PrivacyOptions {
    isContains?: boolean;
    isShow?: boolean;
    isAgree?: boolean;
}

// ---------------------------------------------------------------------------
// 离线定位记录 (Room 黑匣子返回的数据结构)
// ---------------------------------------------------------------------------

export interface OfflineLocationRecord {
    /** Room 数据库自增主键 — ACK 时需要回传此 ID */
    id: number;
    /** 纬度 (GCJ-02) */
    lat: number;
    /** 经度 (GCJ-02) */
    lng: number;
    /** 定位精度（米） */
    accuracy: number;
    /** 速度（m/s） */
    speed: number;
    /** 方向角 */
    bearing: number;
    /** 定位时间戳（ms since epoch） */
    timestamp: number;
    /** 是否为模拟定位 */
    isMock: boolean;
    /** 坐标系（固定为 'gcj02'） */
    coordSystem: 'gcj02';
}

// ---------------------------------------------------------------------------
// Plugin 接口
// ---------------------------------------------------------------------------

export interface AMapLocationPlugin {
    // ---- 隐私合规（必须在定位前调用） ----
    updatePrivacyShow(options: { isContains: boolean; isShow: boolean }): Promise<void>;
    updatePrivacyAgree(options: { isAgree: boolean }): Promise<void>;

    // ---- 一次定位 ----
    getCurrentPosition(options: GetCurrentPositionOptions): Promise<AMapPosition>;

    // ---- 连续定位 ----
    startWatch(options: StartWatchOptions): Promise<{ watchId: string }>;
    stopWatch(): Promise<void>;

    // ---- 事件监听 ----
    addListener(
        eventName: 'locationUpdate',
        handler: (data: AMapPosition) => void,
    ): Promise<PluginListenerHandle>;

    addListener(
        eventName: 'locationError',
        handler: (data: AMapLocationError) => void,
    ): Promise<PluginListenerHandle>;

    removeAllListeners(): Promise<void>;

    // ---- 强制销毁（stop 超时保护） ----
    /**
     * 强制销毁 AMapLocationClient 实例。
     * 在 stopWatch 超时（2s 未确认停止）时由 bridge 的 safeStopWatch 调用。
     * Native 端实现：stopLocation() + onDestroy() + client = null。
     * 调用后会 notifyListeners('locationError', { code: FORCE_DESTROY }) 以通知 TS 层。
     */
    forceDestroy(): Promise<void>;

    // ---- 前台 Service 后台定位 ----
    /**
     * 启动前台定位 Service，确保锁屏/切后台/黑屏后持续获取高精度定位。
     * 会在通知栏显示常驻通知。
     *
     * @param options.notificationTitle 通知标题（默认 "City Lord"）
     * @param options.notificationBody  通知内容（默认 "正在追踪您的位置…"）
     */
    startTracking(options?: {
        notificationTitle?: string;
        notificationBody?: string;
    }): Promise<void>;

    /**
     * 停止前台定位 Service，移除常驻通知，释放所有定位资源。
     */
    stopTracking(): Promise<void>;

    /**
     * 更新前台通知中显示的步数。
     * 通知格式："今日 X 步 · 每日跑步语录"
     */
    updateNotificationSteps(options: { steps: number }): Promise<void>;
    
    /**
     * 跳转至系统的应用权限设置页面。
     * iOS 端直接跳转至 App 专属设置页；Android 端尝试适配不同厂商的权限编辑页。
     */
    openAppPermissionSettings(): Promise<{
        opened: boolean;
        route: 'manufacturer' | 'app_details' | 'system_settings';
        component: string;
    }>;

    // ---- Room 黑匣子持久化 (SQLite) ----

    /**
     * 从 Room 数据库拉取指定 sessionId 下所有未同步的离线定位记录。
     * JS 层苏醒后调用此方法，从原生黑匣子中恢复断失的坐标流。
     *
     * @param options.sessionId 跑步会话 ID（对应 runId）
     * @returns 包含 locations 数组和 count 计数的对象
     */
    getOfflineLocations(options: { sessionId: string }): Promise<{
        locations: OfflineLocationRecord[];
        count: number;
    }>;

    /**
     * 将指定 ID 的离线定位记录标记为已同步 (isAcked = true)。
     * JS 层确认处理完毕后调用，完成 ACK 闭环，防止下次苏醒时重复拉取。
     *
     * @param options.ids 需要标记的记录 ID 数组
     * @returns 成功 ACK 的记录数
     */
    acknowledgeLocations(options: { ids: number[] }): Promise<{
        acknowledged: number;
    }>;

    /**
     * @deprecated 已废弃。请使用 getOfflineLocations + acknowledgeLocations 替代。
     * 旧版内存 Buffer 冲洗接口，数据不持久化，存在丢失风险。
     */
    flushBufferedLocations(): Promise<{
        locations: AMapPosition[];
    }>;
}

// ---------------------------------------------------------------------------
// 注册插件（Capacitor 桥接）
// ---------------------------------------------------------------------------

export const AMapLocation = registerPlugin<AMapLocationPlugin>('AMapLocation', {
    // Web 端无原生实现 — bridge 层负责 fallback
    web: undefined,
});
