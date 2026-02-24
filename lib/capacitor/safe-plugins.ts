/**
 * Web-safe wrappers for all Capacitor native plugins.
 * 在非 Capacitor 环境（纯浏览器 / SSR）下静默降级，不会抛错。
 */

// ============== Haptics ==============
export async function safeHapticImpact(style: 'light' | 'medium' | 'heavy' = 'light') {
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy }
    await Haptics.impact({ style: map[style] })
  } catch {
    // Not in Capacitor env or plugin unavailable
  }
}

export async function safeHapticVibrate(duration?: number) {
  try {
    const { Haptics } = await import('@capacitor/haptics')
    await Haptics.vibrate(duration ? { duration } : undefined)
  } catch { }
}

export async function safeHapticNotification(type: 'success' | 'warning' | 'error' = 'success') {
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics')
    const map = { success: NotificationType.Success, warning: NotificationType.Warning, error: NotificationType.Error }
    await Haptics.notification({ type: map[type] })
  } catch { }
}

// ============== Geolocation ==============
export interface SafePosition {
  lat: number
  lng: number
  accuracy: number
  altitude?: number | null
  speed?: number | null
  heading?: number | null
  timestamp: number
}

export async function safeGetCurrentPosition(options?: {
  enableHighAccuracy?: boolean
  timeout?: number
  maximumAge?: number
}): Promise<SafePosition | null> {
  const effectiveEnableHighAccuracy = options?.enableHighAccuracy ?? false;
  const effectiveTimeout = options?.timeout ?? 5000;
  const effectiveMaximumAge = options?.maximumAge ?? 15000;

  try {
    const { Geolocation } = await import('@capacitor/geolocation')
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: effectiveEnableHighAccuracy,
      timeout: effectiveTimeout,
      maximumAge: effectiveMaximumAge,
    })
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      altitude: pos.coords.altitude,
      speed: pos.coords.speed,
      heading: pos.coords.heading,
      timestamp: pos.timestamp,
    }
  } catch {
    // Fallback: try browser Geolocation API
    return new Promise((resolve) => {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude,
            speed: pos.coords.speed,
            heading: pos.coords.heading,
            timestamp: pos.timestamp,
          }),
          () => resolve(null),
          { enableHighAccuracy: effectiveEnableHighAccuracy, timeout: effectiveTimeout, maximumAge: effectiveMaximumAge }
        )
      } else {
        resolve(null)
      }
    })
  }
}

export async function safeWatchPosition(
  callback: (position: SafePosition | null, error?: any) => void,
  options?: { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number }
): Promise<string | null> {
  const effectiveEnableHighAccuracy = options?.enableHighAccuracy ?? false;
  const effectiveTimeout = options?.timeout ?? 5000;
  const effectiveMaximumAge = options?.maximumAge ?? 15000;

  try {
    const { Geolocation } = await import('@capacitor/geolocation')
    const watchId = await Geolocation.watchPosition(
      {
        enableHighAccuracy: effectiveEnableHighAccuracy,
        timeout: effectiveTimeout,
        maximumAge: effectiveMaximumAge,
      },
      (pos, err) => {
        if (err) {
          callback(null, err)
          return
        }
        if (pos) {
          callback({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude,
            speed: pos.coords.speed,
            heading: pos.coords.heading,
            timestamp: pos.timestamp,
          })
        }
      }
    )
    return watchId
  } catch {
    // Fallback: browser watchPosition
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      const id = navigator.geolocation.watchPosition(
        (pos) => callback({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          timestamp: pos.timestamp,
        }),
        (err) => callback(null, err),
        { enableHighAccuracy: effectiveEnableHighAccuracy, timeout: effectiveTimeout, maximumAge: effectiveMaximumAge }
      )
      return `browser-${id}`
    }
    return null
  }
}

export async function safeClearWatch(watchId: string | null) {
  if (!watchId) return
  try {
    if (watchId.startsWith('browser-')) {
      navigator.geolocation.clearWatch(parseInt(watchId.replace('browser-', ''), 10))
    } else {
      const { Geolocation } = await import('@capacitor/geolocation')
      await Geolocation.clearWatch({ id: watchId })
    }
  } catch { }
}

export async function safeRequestGeolocationPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  try {
    const { Geolocation } = await import('@capacitor/geolocation')
    const status = await Geolocation.requestPermissions()
    return status.location as 'granted' | 'denied' | 'prompt'
  } catch {
    // Browser fallback: just check via permissions API
    try {
      if (typeof navigator !== 'undefined' && navigator.permissions) {
        const result = await navigator.permissions.query({ name: 'geolocation' })
        return result.state as 'granted' | 'denied' | 'prompt'
      }
    } catch { }
    return 'prompt'
  }
}

export async function safeCheckGeolocationPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  try {
    const { Geolocation } = await import('@capacitor/geolocation')
    const status = await Geolocation.checkPermissions()
    return status.location as 'granted' | 'denied' | 'prompt'
  } catch {
    try {
      if (typeof navigator !== 'undefined' && navigator.permissions) {
        const result = await navigator.permissions.query({ name: 'geolocation' })
        return result.state as 'granted' | 'denied' | 'prompt'
      }
    } catch { }
    return 'prompt'
  }
}

// ============== Device ==============
export interface SafeDeviceInfo {
  platform: 'ios' | 'android' | 'web'
  model: string
  osVersion: string
  isNative: boolean
}

export async function safeGetDeviceInfo(): Promise<SafeDeviceInfo> {
  try {
    const { Device } = await import('@capacitor/device')
    const info = await Device.getInfo()
    return {
      platform: info.platform as 'ios' | 'android' | 'web',
      model: info.model,
      osVersion: info.osVersion,
      isNative: info.platform !== 'web',
    }
  } catch {
    return {
      platform: 'web',
      model: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 50) : 'unknown',
      osVersion: 'unknown',
      isNative: false,
    }
  }
}

export async function safeGetDeviceId(): Promise<string | null> {
  try {
    const { Device } = await import('@capacitor/device')
    const id = await Device.getId()
    return id.identifier
  } catch {
    return null
  }
}

export async function safeGetBatteryInfo(): Promise<{ level: number; isCharging: boolean } | null> {
  try {
    const { Device } = await import('@capacitor/device')
    const battery = await Device.getBatteryInfo()
    return {
      level: battery.batteryLevel ?? -1,
      isCharging: battery.isCharging ?? false,
    }
  } catch {
    return null
  }
}

// ============== Sensors (Motion / Orientation) ==============
// Note: @capacitor/sensors 不是官方核心插件，根据你项目实际 API 调整
export async function safeStartAccelerometer(
  callback: (event: { x: number; y: number; z: number }) => void
): Promise<(() => void) | null> {
  try {
    const mod = await import(/* webpackIgnore: true */ '@capacitor/sensors')
    if (mod && typeof (mod as any).Sensors?.addListener === 'function') {
      const handle = await (mod as any).Sensors.addListener('accelerometer', callback)
      return () => handle.remove()
    }
  } catch { }

  // Fallback: Web DeviceMotion API
  if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
    const handler = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity
      if (acc) callback({ x: acc.x ?? 0, y: acc.y ?? 0, z: acc.z ?? 0 })
    }
    window.addEventListener('devicemotion', handler)
    return () => window.removeEventListener('devicemotion', handler)
  }
  return null
}

// ============== Sound ==============
// Note: @capacitor/sound 不是官方核心插件，根据实际 API 调整
export async function safePlaySound(path: string) {
  try {
    const mod = await import(/* webpackIgnore: true */ '@capacitor/sound')
    if (mod && typeof (mod as any).Sound?.play === 'function') {
      await (mod as any).Sound.play({ id: path })
      return
    }
  } catch { }

  // Fallback: HTML5 Audio
  try {
    if (typeof window !== 'undefined') {
      const audio = new Audio(path)
      await audio.play()
    }
  } catch { }
}

// ============== Platform Detection Helper ==============
export async function isNativePlatform(): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core')
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

export function isCapacitorAvailable(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor
}

export async function safeGetPlatform(): Promise<'ios' | 'android' | 'web' | 'unknown'> {
  try {
    const { Capacitor } = await import('@capacitor/core')
    return Capacitor.getPlatform()
  } catch {
    return 'web'
  }
}

// ============== Status Bar ==============
export async function safeStatusBarSetStyle(style: 'dark' | 'light') {
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: style === 'dark' ? Style.Dark : Style.Light })
  } catch { }
}

export async function safeStatusBarSetBackgroundColor(color: string) {
  try {
    const { StatusBar } = await import('@capacitor/status-bar')
    await StatusBar.setBackgroundColor({ color })
  } catch { }
}

export async function safeStatusBarSetOverlaysWebView(overlay: boolean) {
  try {
    const { StatusBar } = await import('@capacitor/status-bar')
    await StatusBar.setOverlaysWebView({ overlay })
  } catch { }
}

// ============== Local Notifications ==============
export async function safeRequestLocalNotificationPermission() {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    return await LocalNotifications.requestPermissions()
  } catch {
    return null
  }
}

export async function safeScheduleLocalNotification(options: any) {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.schedule(options)
  } catch { }
}

// ============== App ==============
export async function safeAppAddListener(eventName: string, callback: (state: any) => void) {
  try {
    const { App } = await import('@capacitor/app')
    return await App.addListener(eventName as any, callback)
  } catch {
    return null
  }
}

// ============== Keyboard ==============
export async function safeKeyboardAddListener(eventName: string, callback: (info: any) => void) {
  try {
    const { Keyboard } = await import('@capacitor/keyboard')
    return await Keyboard.addListener(eventName as any, callback)
  } catch {
    return null
  }
}

// ============== Keep Awake ==============
export async function safeKeepAwake() {
  try {
    const { KeepAwake } = await import('@capacitor-community/keep-awake')
    await KeepAwake.keepAwake()
  } catch { }
}

// ============== Background Task ==============
export async function safeBackgroundTaskBeforeExit(handler: () => void) {
  try {
    const { BackgroundTask } = await import('@capawesome/capacitor-background-task')
    return await BackgroundTask.beforeExit(handler)
  } catch {
    return null
  }
}

export async function safeBackgroundTaskFinish(taskId: string) {
  try {
    const { BackgroundTask } = await import('@capawesome/capacitor-background-task')
    await BackgroundTask.finish({ taskId })
  } catch { }
}

// ============== Background Geolocation ==============
export async function safeBackgroundGeolocationAddWatcher(
  options: Record<string, any>,
  callback: (location: any, error: any) => void
): Promise<string | null> {
  try {
    const { registerPlugin } = await import('@capacitor/core')
    const BackgroundGeolocation = registerPlugin<any>('BackgroundGeolocation')
    const watcherId = await BackgroundGeolocation.addWatcher(options, callback)
    return watcherId
  } catch {
    return null
  }
}

export async function safeBackgroundGeolocationRemoveWatcher(id: string) {
  try {
    const { registerPlugin } = await import('@capacitor/core')
    const BackgroundGeolocation = registerPlugin<any>('BackgroundGeolocation')
    await BackgroundGeolocation.removeWatcher({ id })
  } catch { }
}
