"use client"

import React, { useEffect, useState } from "react"

export interface CaptureRippleProps {
  x: number
  y: number
  color?: string
  size?: number
  duration?: number
  onComplete?: () => void
  isTriggered?: boolean
}

export function CaptureRipple({
  x,
  y,
  color = "#22c55e",
  size = 100,
  duration = 1000,
  onComplete,
  isTriggered = true,
}: CaptureRippleProps) {
  const [ripples, setRipples] = useState<Array<{ id: number; delay: number }>>([])

  useEffect(() => {
    if (!isTriggered) return

    // 创建多个波纹
    const newRipples = Array.from({ length: 3 }, (_, index) => ({
      id: Date.now() + index,
      delay: index * 150,
    }))

    setRipples(newRipples)

    // 动画完成后清理
    const timer = setTimeout(() => {
      setRipples([])
      onComplete?.()
    }, duration + 450)

    return () => clearTimeout(timer)
  }, [isTriggered, duration, onComplete])

  return (
    <div
      className="pointer-events-none fixed z-[100]"
      style={{
        left: x,
        top: y,
        width: 0,
        height: 0,
      }}
    >
      {ripples.map((ripple) => (
        <div
          key={ripple.id}
          className="absolute rounded-full border-2"
          style={{
            left: -size / 2,
            top: -size / 2,
            width: size,
            height: size,
            borderColor: color,
            animation: `ripple-out ${duration}ms cubic-bezier(0.4, 0, 0.2, 1) ${ripple.delay}ms forwards`,
            boxShadow: `0 0 20px ${color}40`,
          }}
        />
      ))}

      {/* 中心闪光 */}
      <div
        className="absolute rounded-full"
        style={{
          left: -size / 4,
          top: -size / 4,
          width: size / 2,
          height: size / 2,
          backgroundColor: color,
          opacity: 0.8,
          animation: `ripple-flash ${duration}ms cubic-bezier(0.4, 0, 0.2, 1) forwards`,
        }}
      />
    </div>
  )
}

// 六边形专用波纹效果
export interface HexCaptureRippleProps {
  centerX: number
  centerY: number
  hexSize: number
  color?: string
  onComplete?: () => void
  isTriggered?: boolean
}

export function HexCaptureRipple({
  centerX,
  centerY,
  hexSize,
  color = "#22c55e",
  onComplete,
  isTriggered = true,
}: HexCaptureRippleProps) {
  const [rings, setRings] = useState<Array<{ id: number; delay: number; scale: number }>>([])

  useEffect(() => {
    if (!isTriggered) return

    const newRings = Array.from({ length: 4 }, (_, index) => ({
      id: Date.now() + index,
      delay: index * 100,
      scale: 1 + index * 0.5,
    }))

    setRings(newRings)

    const timer = setTimeout(() => {
      setRings([])
      onComplete?.()
    }, 1500)

    return () => clearTimeout(timer)
  }, [isTriggered, onComplete])

  // 生成六边形路径点
  const generateHexPath = (scale: number) => {
    const points = []
    const size = hexSize * scale

    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2
      const x = size * Math.cos(angle)
      const y = size * Math.sin(angle)
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`)
    }

    return points.join(" ")
  }

  return (
    <div
      className="pointer-events-none fixed z-[100]"
      style={{
        left: centerX,
        top: centerY,
      }}
    >
      {rings.map((ring) => (
        <svg
          key={ring.id}
          width={hexSize * ring.scale * 2}
          height={hexSize * ring.scale * 2}
          viewBox={`-${hexSize * ring.scale} -${hexSize * ring.scale} ${hexSize * ring.scale * 2} ${hexSize * ring.scale * 2}`}
          className="absolute"
          style={{
            left: -hexSize * ring.scale,
            top: -hexSize * ring.scale,
            animation: `hex-ripple-out 1500ms cubic-bezier(0.4, 0, 0.2, 1) ${ring.delay}ms forwards`,
          }}
        >
          <polygon
            points={generateHexPath(ring.scale)}
            fill="none"
            stroke={color}
            strokeWidth="2"
            style={{
              filter: `drop-shadow(0 0 8px ${color}80)`,
            }}
          />
        </svg>
      ))}

      {/* 中心发光 */}
      <div
        className="absolute rounded-full"
        style={{
          left: -hexSize / 4,
          top: -hexSize / 4,
          width: hexSize / 2,
          height: hexSize / 2,
          background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
          opacity: 0.9,
          animation: "hex-flash 800ms ease-out forwards",
        }}
      />
    </div>
  )
}
