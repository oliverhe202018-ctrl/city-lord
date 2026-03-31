"use client"

import nextDynamic from "next/dynamic"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, LocateFixed, Route, X, Signal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useLocationStore } from "@/store/useLocationStore"
import { isNativePlatform, safeOpenAppSettings } from "@/lib/capacitor/safe-plugins"
import { toast } from "sonner"

const StartRunMap = nextDynamic(
  () => import("@/components/citylord/start/StartRunMap").then(mod => mod.StartRunMap),
  { ssr: false }
)

interface RouteItem {
  id: string
  name: string
  distance: number
  capture_area: number
  waypoints: unknown[]
}

type BatteryOptimizationResult = {
  ignoring?: boolean
  isIgnoring?: boolean
  value?: boolean
}

type BatteryOptimizationPlugin = {
  isIgnoringBatteryOptimizations?: () => Promise<BatteryOptimizationResult | boolean>
}

const BATTERY_GUIDE: Array<{ brand: string; steps: string[] }> = [
  { brand: "三星 Samsung", steps: ["设置 > 应用 > City Lord", "电池 > 不受限制", "后台使用权限选择允许"] },
  { brand: "Google Pixel", steps: ["设置 > 应用 > City Lord > 电池", "后台限制改为无限制", "允许后台活动"] },
  { brand: "华为 Huawei", steps: ["设置 > 应用和服务 > 应用启动管理", "关闭自动管理", "手动开启自启动/后台活动/关联启动"] },
  { brand: "一加 OnePlus", steps: ["设置 > 电池 > 应用电池管理", "选择 City Lord", "关闭智能控制并允许后台运行"] },
  { brand: "小米 Xiaomi", steps: ["设置 > 应用设置 > 应用管理 > City Lord", "省电策略选择无限制", "开启自启动并锁定任务卡片"] },
]

function normalizeWaypoints(input: unknown[]): [number, number][] {
  return input
    .map((point) => {
      if (Array.isArray(point) && point.length >= 2) {
        const lng = Number(point[0])
        const lat = Number(point[1])
        if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat] as [number, number]
      }
      if (point && typeof point === "object") {
        const candidate = point as { lng?: number; lat?: number; longitude?: number; latitude?: number }
        const lng = Number(candidate.lng ?? candidate.longitude)
        const lat = Number(candidate.lat ?? candidate.latitude)
        if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat] as [number, number]
      }
      return null
    })
    .filter((point): point is [number, number] => point !== null)
}

export function StartRunPageClient() {
  const router = useRouter()
  const location = useLocationStore((s) => s.location)
  const gpsSignalStrength = useLocationStore((s) => s.gpsSignalStrength)
  const [openPlanner, setOpenPlanner] = useState(false)
  const [routes, setRoutes] = useState<RouteItem[]>([])
  const [selectedPath, setSelectedPath] = useState<[number, number][]>([])
  const [loadingRoutes, setLoadingRoutes] = useState(false)
  const [recenterTrigger, setRecenterTrigger] = useState(0)
  const [showBatteryModal, setShowBatteryModal] = useState(false)
  const [showGuideModal, setShowGuideModal] = useState(false)

  const currentLocation = useMemo<[number, number] | undefined>(() => {
    if (!location) return undefined
    return [location.lng, location.lat]
  }, [location])

  useEffect(() => {
    if (!openPlanner) return
    let alive = true
    const loadRoutes = async () => {
      setLoadingRoutes(true)
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_SERVER || ""}/api/routes`, { credentials: "include" })
        if (!res.ok) throw new Error("加载失败")
        const data = await res.json()
        if (alive) setRoutes(Array.isArray(data) ? data : [])
      } catch {
        toast.error("加载规划路线失败")
      } finally {
        if (alive) setLoadingRoutes(false)
      }
    }
    loadRoutes()
    return () => {
      alive = false
    }
  }, [openPlanner])

  useEffect(() => {
    let mounted = true
    const checkBatteryOptimization = async () => {
      const native = await isNativePlatform()
      if (!native || !mounted) return

      const { Capacitor, registerPlugin } = await import("@capacitor/core")
      if (Capacitor.getPlatform() !== "android") return

      let restricted = true
      try {
        const AMapLocation = registerPlugin<BatteryOptimizationPlugin>("AMapLocation")
        if (typeof AMapLocation.isIgnoringBatteryOptimizations === "function") {
          const result = await AMapLocation.isIgnoringBatteryOptimizations()
          const ignoring = typeof result === "boolean"
            ? result
            : Boolean(result.ignoring ?? result.isIgnoring ?? result.value)
          restricted = !ignoring
        }
      } catch {
        restricted = true
      }

      if (restricted && mounted) setShowBatteryModal(true)
    }
    checkBatteryOptimization()
    return () => {
      mounted = false
    }
  }, [])

  const gpsLabel = gpsSignalStrength === "good" ? "强" : gpsSignalStrength === "weak" ? "弱" : "无"

  return (
    <div className="relative mx-auto h-[100dvh] w-full max-w-md overflow-hidden bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-white">
      <StartRunMap currentLocation={currentLocation} plannedPath={selectedPath} recenterTrigger={recenterTrigger} />

      <div className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+12px)] z-20 flex items-center justify-between px-4">
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 rounded-full border-white/50 bg-white/80 shadow-xl backdrop-blur dark:border-white/15 dark:bg-slate-900/80"
          onClick={() => router.push("/?tab=home")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-11 rounded-full border-white/50 bg-white/85 px-4 text-sm font-semibold shadow-xl backdrop-blur dark:border-white/15 dark:bg-slate-900/80"
              onClick={() => setRecenterTrigger(v => v + 1)}
            >
              <LocateFixed className="mr-2 h-4 w-4" />
              定位
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-full border-white/50 bg-white/85 px-4 text-sm font-semibold shadow-xl backdrop-blur dark:border-white/15 dark:bg-slate-900/80"
              onClick={() => setOpenPlanner(true)}
            >
              <Route className="mr-2 h-4 w-4" />
              智能规划
            </Button>
          </div>
          {selectedPath.length > 0 && (
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full border-white/50 bg-white/85 text-lg shadow-xl backdrop-blur dark:border-white/15 dark:bg-slate-900/80"
              onClick={() => setSelectedPath([])}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-[30px] border-t border-white/60 bg-white/75 px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/78">
        <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-slate-300 dark:bg-slate-600" />
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-3xl font-extrabold leading-none">0 m²</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">预计占领</p>
          </div>
          <div className="flex items-center gap-1.5 text-rose-500 dark:text-rose-300">
            <span className="text-sm font-semibold">GPS {gpsLabel}</span>
            <Signal className="h-4 w-4" />
          </div>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-2xl font-black leading-none">0.00 km</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">距离</p>
          </div>
          <div>
            <p className="text-2xl font-black leading-none">00:00</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">时长</p>
          </div>
          <div>
            <p className="text-2xl font-black leading-none">0:00</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">平均配速</p>
          </div>
        </div>

        <Button
          className="h-14 w-full rounded-2xl bg-slate-900 text-xl font-extrabold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          onClick={() => router.push("/?tab=home&run=1")}
        >
          开始跑步
        </Button>
      </div>

      <Drawer open={openPlanner} onOpenChange={setOpenPlanner}>
        <DrawerContent className="max-h-[78vh] rounded-t-3xl">
          <DrawerHeader>
            <DrawerTitle>选择规划路径</DrawerTitle>
          </DrawerHeader>
          <ScrollArea className="px-4 pb-6">
            <div className="space-y-3">
              {loadingRoutes && <p className="py-8 text-center text-sm text-muted-foreground">正在加载...</p>}
              {!loadingRoutes && routes.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">暂无可用路线</p>}
              {!loadingRoutes && routes.map((route) => (
                <button
                  key={route.id}
                  className="w-full rounded-xl border border-border bg-card p-4 text-left transition-colors active:bg-accent"
                  onClick={() => {
                    setSelectedPath(normalizeWaypoints(Array.isArray(route.waypoints) ? route.waypoints : []))
                    setOpenPlanner(false)
                  }}
                >
                  <p className="font-semibold text-foreground">{route.name || "未命名路线"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{(route.distance || 0).toFixed(2)} km · {(route.capture_area || 0).toFixed(2)} km²</p>
                </button>
              ))}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>

      {showBatteryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-[90%] max-w-sm bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between bg-rose-500 px-5 py-3 text-white">
              <h2 className="text-base font-extrabold">检测到电池优化限制</h2>
              <button
                type="button"
                onClick={() => setShowBatteryModal(false)}
                className="rounded-md p-1 text-white/90 hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm leading-7 text-rose-900 dark:text-rose-100">
                电池优化会在锁屏时中断 GPS 轨迹记录，导致跑步距离和占领结果异常。建议立即将 City Lord 设置为“不受限制”或“允许后台运行”。
              </p>
              <div className="mt-5 space-y-3">
                <Button
                  className="h-12 w-full rounded-xl bg-slate-900 text-white hover:bg-slate-800"
                  onClick={async () => {
                    const opened = await safeOpenAppSettings()
                    if (!opened) toast.info("请手动前往系统设置关闭电池优化")
                  }}
                >
                  打开设置 (Open settings)
                </Button>
                <Button
                  variant="outline"
                  className="h-12 w-full rounded-xl border-rose-300 bg-white text-rose-700 hover:bg-rose-50"
                  onClick={() => setShowGuideModal(true)}
                >
                  阅读指南 (Read article)
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={showGuideModal} onOpenChange={setShowGuideModal}>
        <DialogContent className="h-[100dvh] max-w-md rounded-none border-0 p-0" showCloseButton={false}>
          <div className="flex h-full flex-col bg-background">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-base font-bold">电池优化关闭指南</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowGuideModal(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <ScrollArea className="flex-1 px-4 py-4">
              <div className="space-y-5 text-sm leading-7">
                {BATTERY_GUIDE.map((item) => (
                  <div key={item.brand} className="rounded-xl border border-border bg-card p-4">
                    <h3 className="mb-2 text-base font-bold">{item.brand}</h3>
                    {item.steps.map((step, index) => (
                      <p key={`${item.brand}-${index}`}>{index + 1}. {step}</p>
                    ))}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
