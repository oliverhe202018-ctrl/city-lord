import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, Volume2, Mic, Map as MapIcon, Download, Zap, Smartphone, Target, Hexagon, MapPin } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { useGameStore, useGameActions } from "@/store/useGameStore"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { toast } from "sonner"
import { isNativePlatform, safeOpenAppSettings } from "@/lib/capacitor/safe-plugins"
import { createClient } from "@/lib/supabase/client"

interface RunningSettingsProps {
  isOpen: boolean
  onClose: () => void
}

const TERRITORY_PALETTE = [
  "#22C55E", "#16A34A", "#10B981", "#14B8A6", "#06B6D4", "#0EA5E9",
  "#3B82F6", "#2563EB", "#4F46E5", "#6366F1", "#8B5CF6", "#A855F7",
  "#D946EF", "#EC4899", "#F43F5E", "#EF4444", "#F97316", "#F59E0B",
  "#EAB308", "#84CC16", "#65A30D", "#F43F5E", "#38BDF8", "#F87171",
]

export function RunningSettings({ isOpen, onClose }: RunningSettingsProps) {
  const { appSettings, territoryAppearance } = useGameStore()
  const { updateAppSettings, setTerritoryAppearance } = useGameActions()
  const [showBgDisclosure, setShowBgDisclosure] = useState(false)
  const [isPendingEnable, setIsPendingEnable] = useState(false)
  const [showTerritoryPanel, setShowTerritoryPanel] = useState(false)
  const [isSavingTerritory, setIsSavingTerritory] = useState(false)

  const handleToggleKeepAlive = async (checked: boolean) => {
    if (checked) {
      const hasAgreed = localStorage.getItem('bg_location_agreed') === 'true'
      if (!hasAgreed) {
        setShowBgDisclosure(true)
        setIsPendingEnable(true)
        return
      }
      
      // 已同意协议，检查系统权限
      if (await isNativePlatform()) {
        toast.info("针对 Android 11+，请确保在系统权限设置中选择“始终允许”以获得最佳保活效果", {
          duration: 5000,
          action: {
            label: "去设置",
            onClick: () => safeOpenAppSettings()
          }
        });
      }
    }
    updateAppSettings({ keepAliveEnabled: checked })
  }

  const confirmDisclosure = async () => {
    localStorage.setItem('bg_location_agreed', 'true')
    setShowBgDisclosure(false)
    if (isPendingEnable) {
      updateAppSettings({ keepAliveEnabled: true })
      setIsPendingEnable(false)
    }
    
    // 引导去设置页触发真正后台权限
    if (await isNativePlatform()) {
       toast.success("协议已确认，请在接下来的系统设置中手动选择“始终允许”", {
         duration: 4000
       });
       setTimeout(() => {
         safeOpenAppSettings();
       }, 1500);
    }
  }

  const saveTerritoryAppearance = async () => {
    setIsSavingTerritory(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        toast.error('请先登录后再保存领地配色')
        return
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          path_color: territoryAppearance.strokeColor,
          fill_color: territoryAppearance.fillColor,
          fill_opacity: territoryAppearance.fillOpacity,
        })
        .eq('id', user.id)

      if (error) {
        throw error
      }

      toast.success('领地调色盘已同步')
      setShowTerritoryPanel(false)
      window.dispatchEvent(new CustomEvent('citylord:refresh-territories'))
    } catch (error) {
      console.error('Failed to save territory appearance', error)
      toast.error('领地配色保存失败')
    } finally {
      setIsSavingTerritory(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-[100] flex flex-col bg-[#f5f5f5] text-black animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center px-4 py-4 bg-white border-b border-gray-100">
          <button onClick={onClose} className="p-2 -ml-2 text-gray-600 hover:text-black">
            <ChevronLeft size={24} />
          </button>
          <h1 className="flex-1 text-center text-lg font-bold">运动设置</h1>
          <div className="w-10" /> {/* Spacer */}
        </div>

        {/* Settings List */}
        <div className="flex-1 overflow-y-auto">
          
          {/* Section 1: Voice */}
          <div className="mt-4 bg-white">
            <SettingItem 
              label="语音播报" 
              rightElement={
                <Switch 
                  checked={appSettings.voiceReportingEnabled} 
                  onCheckedChange={(checked) => updateAppSettings({ voiceReportingEnabled: checked })}
                />
              } 
            />
            <SettingItem 
              label="摇一摇语音播报" 
              rightElement={
                <Switch 
                  checked={appSettings.shakeVoiceEnabled} 
                  onCheckedChange={(checked) => updateAppSettings({ shakeVoiceEnabled: checked })}
                />
              } 
            />
            <SettingItem 
              label="节拍器" 
              badge="新"
              rightElement={
                <Switch 
                  checked={appSettings.metronomeEnabled}
                  onCheckedChange={(checked) => updateAppSettings({ metronomeEnabled: checked })}
                />
              } 
            />
          </div>

          {/* Section 2: Map */}
          <div className="mt-4 bg-white">
            <SettingItem 
              label="地图设置" 
              value="默认" 
              hasArrow 
              onClick={() => toast.info('地图设置功能正在内测开发中')}
            />
            <SettingItem 
              label="离线地图下载" 
              hasArrow 
              onClick={() => toast.info('离线地图下载功能正在内测开发中')}
            />
          </div>

          {/* Section 3: Special (My Territory) */}
          <div className="mt-4 bg-white">
            <div
              onClick={() => setShowTerritoryPanel(true)}
              className="flex items-center justify-between px-4 py-4 active:bg-gray-50 transition-colors cursor-pointer"
            >
              <span className="text-base font-medium text-[#22c55e] flex items-center gap-2">
                <Hexagon className="h-5 w-5 fill-[#22c55e]/10" />
                我的领地
              </span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span
                    className="h-5 w-5 rounded-full border border-white shadow-sm"
                    style={{ backgroundColor: territoryAppearance.strokeColor }}
                  />
                  <span
                    className="h-5 w-5 rounded-full border border-white shadow-sm"
                    style={{ backgroundColor: territoryAppearance.fillColor, opacity: territoryAppearance.fillOpacity }}
                  />
                </div>
                <ChevronRight size={20} className="text-gray-300" />
              </div>
            </div>
          </div>

          {/* Section 4: System */}
          <div className="mt-4 bg-white">
            <SettingItem 
              label="后台雷达保活 (高耗电)" 
              rightElement={
                <Switch 
                  checked={appSettings.keepAliveEnabled} 
                  onCheckedChange={handleToggleKeepAlive} 
                />
              } 
            />
            <SettingItem 
              label="系统通知监听权限" 
              hasArrow 
            />
            <SettingItem 
              label="账号自动同步" 
              hasArrow 
            />
            <SettingItem 
              label="运动时保持屏幕常亮" 
              rightElement={
                <Switch 
                  checked={appSettings.keepScreenOn}
                  onCheckedChange={(checked) => updateAppSettings({ keepScreenOn: checked })}
                />
              } 
            />
            <SettingItem 
              label="每日跑步目标设置" 
              hasArrow 
              onClick={() => toast.info('目标设置功能正在内测开发中')}
            />
            <SettingItem 
              label="定位异常检测" 
              hasArrow 
              onClick={() => toast.info('定位检测功能正在内测开发中')}
            />
          </div>

          <div className="h-20" /> {/* Bottom padding */}
        </div>
      </div>

      <Dialog open={showBgDisclosure} onOpenChange={setShowBgDisclosure}>
        <DialogContent className="bg-white text-black border-none sm:max-w-md p-6 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <MapPin className="h-6 w-6 text-blue-500" />
              后台定位服务说明
            </DialogTitle>
            <DialogDescription className="text-gray-600 pt-4 space-y-4 leading-relaxed text-sm">
              <p>为了确保在您熄屏、将手机放入口袋进行长距离跑步时，绝不中断地记录您的**运动轨迹与领地状态**，我们需要申请【始终允许访问位置信息】的权限。</p>
              <p><strong>即使在应用关闭或未使用时，我们也需要访问您的位置信息数据</strong>，以支持核心的“后台雷达保活”功能，防止记录中断导致的数据丢失。您的位置信息仅用于记录运动轨迹，我们绝对不会将其用于任何跨应用广告跟踪。您可以随时在系统设置中撤回此授权。</p>
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-8">
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-12 font-bold"
              onClick={confirmDisclosure}
            >
              同意并去设置
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => {
                setShowBgDisclosure(false)
                setIsPendingEnable(false)
              }} 
              className="w-full text-gray-400 hover:text-black hover:bg-transparent"
            >
              以后再说
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showTerritoryPanel} onOpenChange={setShowTerritoryPanel}>
        <DialogContent className="bg-white text-black border-none sm:max-w-lg p-0 rounded-3xl overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                <Hexagon className="h-5 w-5 text-emerald-500" />
                领地调色盘
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-500 pt-2">
                修改后地图中的本人领地会立即同步更新。
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-6">
            <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4">
              <p className="text-sm font-semibold text-gray-900">实时预览</p>
              <div className="mt-4 flex items-center justify-center">
                <div
                  className="relative h-28 w-36 rounded-[28px] border-4 shadow-[0_0_24px_rgba(15,23,42,0.08)] transition-all"
                  style={{
                    borderColor: territoryAppearance.strokeColor,
                    backgroundColor: territoryAppearance.fillColor,
                    opacity: territoryAppearance.fillOpacity,
                  }}
                >
                  <div
                    className="absolute inset-0 rounded-[24px]"
                    style={{
                      boxShadow: `0 0 28px ${territoryAppearance.strokeColor}66`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">边界线颜色</p>
                <span className="text-xs font-mono text-gray-500">{territoryAppearance.strokeColor}</span>
              </div>
              <div className="grid grid-cols-6 gap-3">
                {TERRITORY_PALETTE.map((color) => (
                  <button
                    key={`stroke-${color}`}
                    type="button"
                    onClick={() => setTerritoryAppearance({ strokeColor: color })}
                    className={cn(
                      "h-10 w-10 rounded-full border-2 transition-transform active:scale-90",
                      territoryAppearance.strokeColor === color ? "border-slate-900 scale-105" : "border-white"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">填充颜色</p>
                <span className="text-xs font-mono text-gray-500">{territoryAppearance.fillColor}</span>
              </div>
              <div className="grid grid-cols-6 gap-3">
                {TERRITORY_PALETTE.map((color) => (
                  <button
                    key={`fill-${color}`}
                    type="button"
                    onClick={() => setTerritoryAppearance({ fillColor: color })}
                    className={cn(
                      "h-10 w-10 rounded-full border-2 transition-transform active:scale-90",
                      territoryAppearance.fillColor === color ? "border-slate-900 scale-105" : "border-white"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">填充透明度</p>
                <span className="text-xs font-mono text-gray-500">{Math.round(territoryAppearance.fillOpacity * 100)}%</span>
              </div>
              <Slider
                value={[territoryAppearance.fillOpacity]}
                min={0.12}
                max={0.72}
                step={0.02}
                onValueChange={([value]) => setTerritoryAppearance({ fillOpacity: value })}
              />
            </div>
          </div>

          <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => setShowTerritoryPanel(false)}
            >
              取消
            </Button>
            <Button
              className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={saveTerritoryAppearance}
              disabled={isSavingTerritory}
            >
              {isSavingTerritory ? '保存中...' : '保存配色'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface SettingItemProps {
  label: string
  value?: string
  badge?: string
  hasArrow?: boolean
  rightElement?: React.ReactNode
  onClick?: () => void
}

function SettingItem({ label, value, badge, hasArrow, rightElement, onClick }: SettingItemProps) {
  return (
    <div 
      onClick={onClick}
      className="flex items-center justify-between px-4 py-4 border-b border-gray-50 last:border-none active:bg-gray-50 transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-2">
        <span className="text-base font-medium text-gray-900">{label}</span>
        {badge && (
          <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
            {badge}
          </span>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        {value && <span className="text-sm text-gray-500">{value}</span>}
        {rightElement}
        {hasArrow && <ChevronRight size={20} className="text-gray-300" />}
      </div>
    </div>
  )
}
