"use client"

import React, { useEffect, useState, useRef } from "react"

export interface CountingNumberProps {
  value: number
  duration?: number
  decimals?: number
  formatValue?: (value: number) => string
  className?: string
  isTriggered?: boolean
  onAnimationComplete?: () => void
}

export function CountingNumber({
  value,
  duration = 1500,
  decimals = 0,
  formatValue,
  className = "",
  isTriggered = true,
  onAnimationComplete,
}: CountingNumberProps) {
  const [displayValue, setDisplayValue] = useState(value)
  const [isAnimating, setIsAnimating] = useState(false)
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const startValueRef = useRef(value)

  useEffect(() => {
    if (!isTriggered) return

    startValueRef.current = displayValue
    setIsAnimating(true)
    startTimeRef.current = performance.now()

    const animate = (currentTime: number) => {
      if (startTimeRef.current === null) return

      const elapsed = currentTime - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)

      // 使用 ease-out 缓动函数
      const easeOut = 1 - Math.pow(1 - progress, 3)
      const currentValue = startValueRef.current + (value - startValueRef.current) * easeOut

      setDisplayValue(currentValue)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        setIsAnimating(false)
        onAnimationComplete?.()
      }
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [value, duration, isTriggered, onAnimationComplete, displayValue])

  const formattedValue = formatValue
    ? formatValue(displayValue)
    : displayValue.toFixed(decimals)

  return (
    <span
      className={`inline-block transition-transform duration-200 ${
        isAnimating ? "scale-110" : "scale-100"
      } ${className}`}
    >
      {formattedValue}
    </span>
  )
}

// 适用于面积单位的计数组件
export interface CountingAreaProps {
  area: number
  duration?: number
  unit?: "m²" | "km²" | "tiles"
  className?: string
  isTriggered?: boolean
}

export function CountingArea({
  area,
  duration = 1500,
  unit = "m²",
  className = "",
  isTriggered = true,
}: CountingAreaProps) {
  const formatArea = (value: number) => {
    let formattedValue: string
    let formattedUnit: string

    if (unit === "km²") {
      formattedValue = (value / 1000000).toFixed(2)
      formattedUnit = "km²"
    } else if (unit === "tiles") {
      formattedValue = Math.floor(value).toLocaleString()
      formattedUnit = " tiles"
    } else {
      formattedValue = Math.floor(value).toLocaleString()
      formattedUnit = " m²"
    }

    return `${formattedValue}${formattedUnit}`
  }

  return (
    <CountingNumber
      value={area}
      duration={duration}
      formatValue={formatArea}
      className={className}
      isTriggered={isTriggered}
    />
  )
}

// 适用于距离的计数组件
export interface CountingDistanceProps {
  distance: number
  duration?: number
  unit?: "m" | "km"
  decimals?: number
  className?: string
  isTriggered?: boolean
}

export function CountingDistance({
  distance,
  duration = 1500,
  unit = "km",
  decimals = 2,
  className = "",
  isTriggered = true,
}: CountingDistanceProps) {
  const formatDistance = (value: number) => {
    let formattedValue: string

    if (unit === "km") {
      formattedValue = (value / 1000).toFixed(decimals)
    } else {
      formattedValue = Math.floor(value).toLocaleString()
    }

    return `${formattedValue} ${unit}`
  }

  return (
    <CountingNumber
      value={distance}
      duration={duration}
      formatValue={formatDistance}
      className={className}
      isTriggered={isTriggered}
    />
  )
}

// 适用于积分的计数组件
export interface CountingPointsProps {
  points: number
  duration?: number
  decimals?: number
  className?: string
  isTriggered?: boolean
}

export function CountingPoints({
  points,
  duration = 1500,
  decimals = 0,
  className = "",
  isTriggered = true,
}: CountingPointsProps) {
  const formatPoints = (value: number) => {
    return `+${Math.floor(value).toLocaleString()}`
  }

  return (
    <CountingNumber
      value={points}
      duration={duration}
      decimals={decimals}
      formatValue={formatPoints}
      className={className}
      isTriggered={isTriggered}
    />
  )
}
