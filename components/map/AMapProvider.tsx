"use client"

import { ReactNode } from "react"

// MapRoot 已经是 client-only 组件，如果路径不同自行调整
import { MapRoot } from "./MapRoot"

/**
 * 兼容旧引用的 AMapProvider，占位 + 转发到 MapRoot。
 * 让所有 legacy chunk / 动态 import 都能顺利拿到一个合法组件。
 */
interface AMapProviderProps {
  children: ReactNode
}

export function AMapProvider({ children }: AMapProviderProps) {
  return (
    <MapRoot>
      {children}
    </MapRoot>
  )
}

// 保持默认导出（以防某些旧代码 default import）
export default AMapProvider