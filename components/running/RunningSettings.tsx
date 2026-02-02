"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Volume2, Mic, Map as MapIcon, Download, Zap, Smartphone, Target, Hexagon } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

interface RunningSettingsProps {
  isOpen: boolean
  onClose: () => void
}

export function RunningSettings({ isOpen, onClose }: RunningSettingsProps) {
  if (!isOpen) return null

  return (
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
            value="国语女声" 
            hasArrow 
          />
          <SettingItem 
            label="摇一摇语音播报" 
            rightElement={<Switch defaultChecked />} 
          />
          <SettingItem 
            label="节拍器" 
            badge="新"
            rightElement={<Switch />} 
          />
        </div>

        {/* Section 2: Map */}
        <div className="mt-4 bg-white">
          <SettingItem 
            label="地图设置" 
            value="默认" 
            hasArrow 
          />
          <SettingItem 
            label="离线地图下载" 
            hasArrow 
          />
        </div>

        {/* Section 3: Special (My Territory) */}
        <div className="mt-4 bg-white">
          <div className="flex items-center justify-between px-4 py-4 active:bg-gray-50 transition-colors cursor-pointer">
            <span className="text-base font-medium text-[#22c55e] flex items-center gap-2">
              <Hexagon className="h-5 w-5 fill-[#22c55e]/10" />
              我的领地
            </span>
            <ChevronRight size={20} className="text-gray-300" />
          </div>
        </div>

        {/* Section 4: System */}
        <div className="mt-4 bg-white">
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
            rightElement={<Switch />} 
          />
          <SettingItem 
            label="每日跑步目标设置" 
            hasArrow 
          />
          <SettingItem 
            label="定位异常检测" 
            hasArrow 
          />
        </div>

        <div className="h-20" /> {/* Bottom padding */}
      </div>
    </div>
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
