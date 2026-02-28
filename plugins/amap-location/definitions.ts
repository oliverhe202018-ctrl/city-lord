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

    // ---- 后台定位 (TODO: 待 Foreground Service 实现) ----
    /**
     * TODO: 启动后台定位（需要 Foreground Service 通知）
     * 实现计划：
     *  - 使用 @capacitor-community/foreground-service 插件
     *  - 启动前台通知，保持 GPS 活跃
     *  - 跑步页面进入后台时自动调用
     *  - 返回前台时自动切换回常规模式
     *
     * @param options.title 通知标题
     * @param options.body  通知内容
     * @param options.icon  通知图标资源名
     */
    // enableBackgroundLocation?(options: {
    //     title: string;
    //     body: string;
    //     icon?: string;
    // }): Promise<void>;

    /**
     * TODO: 停止后台定位，移除前台通知
     */
    // disableBackgroundLocation?(): Promise<void>;
}

// ---------------------------------------------------------------------------
// 注册插件（Capacitor 桥接）
// ---------------------------------------------------------------------------

export const AMapLocation = registerPlugin<AMapLocationPlugin>('AMapLocation', {
    // Web 端无原生实现 — bridge 层负责 fallback
    web: undefined,
});
