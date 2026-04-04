"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, LocateFixed, List, X, Signal } from "lucide-react"
import * as turf from "@turf/turf"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useLocationStore } from "@/store/useLocationStore"
import { useGameStore } from "@/store/useGameStore"
import { useRouteListStore } from "@/store/useRouteListStore"
import { useLocationContext } from "@/components/GlobalLocationProvider"
import { isNativePlatform, safeOpenAppSettings } from "@/lib/capacitor/safe-plugins"
import { App } from "@capacitor/app"
import { toast } from "sonner"
import type { PlannerRoute } from "@/types/route-list"

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

interface StartRunOverlayProps {
  onBack: () => void
  onBeginRun: () => void
}

export function StartRunOverlay({ onBack, onBeginRun }: StartRunOverlayProps) {
  const gpsSignalStrength = useLocationStore((s) => s.gpsSignalStrength)
  const ghostPath = useGameStore((s) => s.ghostPath)
  const setGhostPath = useGameStore((s) => s.setGhostPath)
  const selectedRoute = useRouteListStore((state) => state.selectedRoute)
  const openRouteList = useRouteListStore((state) => state.openRouteList)
  const closeRouteList = useRouteListStore((state) => state.closeRouteList)
  const clearSelectedRoute = useRouteListStore((state) => state.clearSelectedRoute)
  const { retry } = useLocationContext()
  const [previewRoute, setPreviewRoute] = useState<PlannerRoute | null>(null)
  const [showBatteryModal, setShowBatteryModal] = useState(false)
  const [showGuideModal, setShowGuideModal] = useState(false)

  useEffect(() => {
    if (!selectedRoute) return
    const normalizedPath = selectedRoute.waypoints
      .map((point) => {
        const lat = Number(point.lat)
        const lng = Number(point.lng)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
        return [lat, lng] as [number, number]
      })
      .filter((point): point is [number, number] => point !== null)
    if (normalizedPath.length > 0) {
      setPreviewRoute(selectedRoute)
      setGhostPath(normalizedPath)
      closeRouteList()
      clearSelectedRoute()
      return
    }
    toast.error("该路线缺少有效坐标，无法预览")
    closeRouteList()
    clearSelectedRoute()
  }, [clearSelectedRoute, closeRouteList, selectedRoute, setGhostPath])

  const handleOpenRouteList = useCallback(() => {
    openRouteList('start')
  }, [openRouteList])

  const handleClearPreview = useCallback(() => {
    setPreviewRoute(null)
    setGhostPath(null)
  }, [setGhostPath])

  const checkBatteryOptimization = useCallback(async () => {
    const skipWarning = localStorage.getItem("city-lord-skip-battery-warning") === "true"
    if (skipWarning) return

    const native = await isNativePlatform()
    if (!native) return

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
      // 容错处理：如果 API 失败，保守起见在某些 ROM 上不反复弹窗干扰，此处若 API 异常可考虑放行
      restricted = false
    }

    setShowBatteryModal(restricted)
  }, [])

  useEffect(() => {
    checkBatteryOptimization()

    const listenerPromise = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        checkBatteryOptimization()
      }
    })

    return () => {
      listenerPromise.then(l => l.remove())
    }
  }, [checkBatteryOptimization])

  const gpsLabel = gpsSignalStrength === "good" ? "强" : gpsSignalStrength === "weak" ? "弱" : "无"
  const plannedPointCount = ghostPath?.length ?? 0
  const previewDistanceKm = previewRoute?.distance ?? 0
  const estimatedMinutes = Math.max(0, Math.round(previewDistanceKm * 6))
  const estimatedAreaLabel = useMemo(() => {
    if (!ghostPath || ghostPath.length < 3) return "0 m²"
    const ring = ghostPath.map(([lat, lng]) => [lng, lat] as [number, number])
    const [firstLng, firstLat] = ring[0]
    const [lastLng, lastLat] = ring[ring.length - 1]
    const closedRing = firstLng === lastLng && firstLat === lastLat ? ring : [...ring, [firstLng, firstLat] as [number, number]]
    try {
      const polygon = turf.polygon([closedRing])
      const area = turf.area(polygon)
      const safeArea = Number.isFinite(area) ? Math.max(0, area) : 0
      return `${Math.round(safeArea).toLocaleString("zh-CN")} m²`
    } catch {
      return "0 m²"
    }
  }, [ghostPath])

  return (
    <div className="absolute inset-0 z-40 text-slate-900 dark:text-white">
      <div className="pointer-events-none absolute inset-0 bg-transparent" />

      <div className="pointer-events-auto relative inset-x-0 top-[calc(env(safe-area-inset-top)+12px)] z-50 flex items-center justify-between px-4">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 rounded-full border border-slate-200/60 bg-white text-slate-900 shadow-lg"
          onClick={onBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11 rounded-full border border-slate-200/60 bg-white text-slate-900 shadow-lg"
              onClick={() => retry()}
            >
              <LocateFixed className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full border border-slate-200/60 bg-white px-4 text-sm font-semibold text-slate-900 shadow-lg"
              onClick={handleOpenRouteList}
            >
              <List className="mr-2 h-4 w-4" />
              我的规划路线
            </Button>
          </div>
          {(previewRoute || plannedPointCount > 0) && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full border border-slate-200/60 bg-white text-lg text-slate-900 shadow-lg"
              onClick={handleClearPreview}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 rounded-t-[30px] border-t border-white/60 bg-white/75 px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/78">
        <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-slate-300 dark:bg-slate-600" />
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-3xl font-extrabold leading-none">{estimatedAreaLabel}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">预计占领</p>
          </div>
          <div className="flex items-center gap-1.5 text-rose-500 dark:text-rose-300">
            <span className="text-sm font-semibold">GPS {gpsLabel}</span>
            <Signal className="h-4 w-4" />
          </div>
        </div>

        {(previewRoute || plannedPointCount > 0) && (
          <div className="mb-4 rounded-2xl border border-emerald-300/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-300">
            {previewRoute
              ? `已选择路线 · ${previewRoute.name || "未命名路线"} · ${previewDistanceKm.toFixed(2)} km · 预计 ${estimatedMinutes} 分钟`
              : `已载入规划路径 · ${plannedPointCount} 个轨迹点`}
          </div>
        )}

        <div className="mb-5 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-2xl font-black leading-none">{previewDistanceKm.toFixed(2)} km</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">距离</p>
          </div>
          <div>
            <p className="text-2xl font-black leading-none">{estimatedMinutes} 分钟</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">预计时间</p>
          </div>
          <div>
            <p className="text-2xl font-black leading-none">6:00</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">平均配速</p>
          </div>
        </div>

        <Button
          type="button"
          className="h-14 w-full rounded-2xl bg-slate-900 text-xl font-extrabold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          onClick={onBeginRun}
        >
          开始跑步
        </Button>
      </div>

      {showBatteryModal && (
        <div
          className="pointer-events-auto fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setShowBatteryModal(false)}
        >
          <div
            className="pointer-events-auto w-[90%] max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
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
                  type="button"
                  className="h-12 w-full rounded-xl bg-slate-900 text-white hover:bg-slate-800"
                  onClick={async () => {
                    const opened = await safeOpenAppSettings()
                    if (!opened) toast.info("请手动前往系统设置关闭电池优化")
                  }}
                >
                  打开设置 (Open settings)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full rounded-xl border-rose-300 bg-white text-rose-700 hover:bg-rose-50"
                  onClick={() => {
                    localStorage.setItem("city-lord-skip-battery-warning", "true")
                    setShowBatteryModal(false)
                    toast.success("已设置不再提醒")
                  }}
                >
                  不再提醒 (Don't remind again)
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 w-full text-xs text-muted-foreground underline-offset-4 hover:underline"
                  onClick={() => setShowGuideModal(true)}
                >
                  阅读关闭指南 (Read guide article)
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={showGuideModal} onOpenChange={setShowGuideModal}>
        <DialogContent className="pointer-events-auto h-[100dvh] max-w-md rounded-none border-0 p-0" showCloseButton={false}>
          <div className="flex h-full flex-col bg-background">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-base font-bold">电池优化关闭指南</h2>
              <Button type="button" variant="ghost" size="icon" onClick={() => setShowGuideModal(false)}>
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

export { StartRunOverlay as StartRunPageClient }
