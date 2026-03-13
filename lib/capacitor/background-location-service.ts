import { registerPlugin } from '@capacitor/core'
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation'
import gcoord from 'gcoord'

export const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation')

// 每次触发的位置记录，包含 timestamp
export interface BackgroundLocation {
    latitude: number
    longitude: number
    accuracy: number
    altitude: number | null
    altitudeAccuracy: number | null
    simulated: boolean
    speed: number | null
    bearing: number | null
    time: number // unix timestamp
}

export type LocationWatcherId = string

// 可配置选项
export interface LocationWatcherOptions {
    backgroundMessage?: string
    backgroundTitle?: string
    distanceFilter?: number // metros
    requestPermissions?: boolean
    stale?: boolean
}

class BackgroundLocationManager {
    private watcherId: LocationWatcherId | null = null
    private isRunningHighFreq = false
    private isKeepAliveMode = false

    /**
     * 开始高频记录模式 (跑步中)
     * - `distanceFilter: 2` (2米即更新)
     * - 当应用切后台时，前台服务会弹出一个尽可能持久的通知
     */
    async startHighFrequencyTracking(callback: (location: BackgroundLocation) => void): Promise<void> {
        if (this.watcherId) {
            await this.stopTracking()
        }

        this.isRunningHighFreq = true
        this.isKeepAliveMode = false

        // 运动格言池
        const randomQuote = this.getMotivationalMessage()

        this.watcherId = await BackgroundGeolocation.addWatcher(
            {
                backgroundMessage: randomQuote,
                backgroundTitle: 'City Lord 正在记录您的轨迹',
                requestPermissions: true,
                stale: false,
                distanceFilter: 2 // 2 meters high freq
            },
            (location, error) => {
                if (error) {
                    if (error.code === 'NOT_AUTHORIZED') {
                        console.warn('[BgLoc] User denied location permission.')
                    }
                    return
                }
                if (location && this.isRunningHighFreq) {
                    // capacitor-community/background-geolocation typically returns WGS84.
                    // Transform to GCJ02 for AMap via gcoord
                    const transformed = gcoord.transform(
                        [location.longitude, location.latitude],
                        gcoord.WGS84,
                        gcoord.GCJ02
                    )

                    callback({
                        ...location,
                        longitude: transformed[0],
                        latitude: transformed[1],
                        time: location.time ?? Date.now()
                    })
                }
            }
        )
        console.log(`[BgLoc] Started high-frequency tracking. WatcherId: ${this.watcherId}`)
    }

    /**
     * 开始低频保活模式 (非跑步态)
     * 仅在用户开启“后台雷达”等需持续接收挑战通知的产品设开关时调用。
     * - `distanceFilter: 50` 降低功耗
     */
    async startKeepAliveTracking(): Promise<void> {
        if (this.watcherId) {
            await this.stopTracking()
        }

        this.isRunningHighFreq = false
        this.isKeepAliveMode = true

        this.watcherId = await BackgroundGeolocation.addWatcher(
            {
                backgroundMessage: '接收到周围势力的异动即可唤醒',
                backgroundTitle: 'City Lord 雷达警戒中',
                requestPermissions: true,
                stale: false,
                distanceFilter: 50 // 50 meters low freq
            },
            (location, error) => {
                if (error) {
                    console.warn('[BgLoc] KeepAlive error:', error)
                    return;
                }
                
                if (location && this.isKeepAliveMode && window) {
                   // Keep-alive doesn't necessarily need robust frontend callback handling,
                   // but we could emit an event if needed or store it.
                }
            }
        )
        console.log(`[BgLoc] Started keep-alive tracking. WatcherId: ${this.watcherId}`)
    }

    /**
     * 停止任何形态的后台定位服务
     */
    async stopTracking(): Promise<void> {
        if (this.watcherId) {
            await BackgroundGeolocation.removeWatcher({ id: this.watcherId })
            console.log(`[BgLoc] Stopped tracking. WatcherId: ${this.watcherId}`)
            this.watcherId = null
        }
        this.isRunningHighFreq = false
        this.isKeepAliveMode = false
    }

    isHighFrequencyActive(): boolean {
        return this.isRunningHighFreq
    }

    private getMotivationalMessage(): string {
        const messages = [
            "每一步都在丈量你的领地！",
            "坚持就是胜利，你的城市正在扩大！",
            "燃烧卡路里，占领更多街区！",
            "城市之主非你莫属，继续前行！",
            "汗水是扩张领土的最佳证明！",
            "脚步不停，版图不息！",
            "继续奔跑，整座城市都在注视你！",
            "感受风的速度，那是你征服城市的号角！",
            "多跑一公里，领地就多一分坚固！",
            "没有白走的路，每一步算作城池！",
            "打破昨日的边界，扩张今日的版图！",
            "跑得越远，世界越属于你！",
            "把街道变成跑道，把城市变成领土！",
            "此时的汗水，将化为明日王都的基石！",
            "保持节奏，胜利就在前方几个街区！",
            "前方的迷雾，只为你轻盈的脚步而散开！",
            "每一次心跳，都是开疆拓土的鼓点！",
            "丈量大地，从你的脚下开始！",
            "别停下，新的领地正在地图上亮起！",
            "越野越跑，越野越强！",
            "一步一个脚印，走出你的雄图霸业！",
            "冲刺吧，目标就在前面的转角处！",
            "挥洒汗水，用坚持浇灌你的王权！",
            "把懦弱留在身后，把城池推向远方！",
            "呼吸、迈步、征服，就是这么简单！",
            "你就是城市的风暴，继续席卷吧！",
            "突破极限，因为你的名字是领主！",
            "路在脚下，领地在心中，一往无前！",
            "没有人能阻挡你扩张的步伐，除了你自己！",
            "燃烧的不仅仅是脂肪，还有你的斗志！",
            "地图上的每一道轨迹，都是你的勋章！",
            "伟大的领主，从不吝啬自己的汗水！",
            "坚持！城墙也是一块一块石头垒起来的！",
            "感受大地的心跳，与你的步伐共鸣！",
            "为了无尽的领地，今天也要全力以赴！"
        ]
        return messages[Math.floor(Math.random() * messages.length)]
    }
}

export const backgroundLocationService = new BackgroundLocationManager()
