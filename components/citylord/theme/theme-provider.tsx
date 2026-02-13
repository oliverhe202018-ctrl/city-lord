"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react"
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

// ============================================================
// Theme Definitions
// ============================================================

export type ThemeId = "cyberpunk" | "light" | "nature" | "custom"

export interface ThemeColors {
  // Base colors
  background: string
  backgroundSecondary: string
  foreground: string
  foregroundMuted: string
  
  // Primary accent
  primary: string
  primaryGlow: string
  primaryMuted: string
  
  // Secondary accent
  secondary: string
  secondaryMuted: string
  
  // Status colors
  success: string
  warning: string
  danger: string
  
  // UI elements
  border: string
  card: string
  cardHover: string
  
  // Map specific
  hexOwned: string
  hexEnemy: string
  hexNeutral: string
  hexUnexplored: string
  hexContested: string
}

export interface Theme {
  id: ThemeId
  name: string
  nameEn: string
  description: string
  colors: ThemeColors
  isDark: boolean
}

// ============================================================
// Theme Presets
// ============================================================

export const themes: Record<ThemeId, Theme> = {
  cyberpunk: {
    id: "cyberpunk",
    name: "赛博朋克",
    nameEn: "Cyberpunk",
    description: "经典深色霓虹风格",
    isDark: true,
    colors: {
      background: "#0f172a",
      backgroundSecondary: "#1e293b",
      foreground: "#ffffff",
      foregroundMuted: "rgba(255,255,255,0.6)",
      
      primary: "#22c55e",
      primaryGlow: "rgba(34,197,94,0.5)",
      primaryMuted: "rgba(34,197,94,0.2)",
      
      secondary: "#06b6d4",
      secondaryMuted: "rgba(6,182,212,0.2)",
      
      success: "#22c55e",
      warning: "#f59e0b",
      danger: "#ef4444",
      
      border: "rgba(255,255,255,0.1)",
      card: "rgba(0,0,0,0.4)",
      cardHover: "rgba(255,255,255,0.1)",
      
      hexOwned: "#22c55e",
      hexEnemy: "#ef4444",
      hexNeutral: "rgba(255,255,255,0.1)",
      hexUnexplored: "rgba(255,255,255,0.02)",
      hexContested: "#eab308",
    },
  },
  light: {
    id: "light",
    name: "清爽日间",
    nameEn: "Light Mode",
    description: "明亮清新的日间模式",
    isDark: false,
    colors: {
      background: "#f8fafc",
      backgroundSecondary: "#ffffff",
      foreground: "#0f172a",
      foregroundMuted: "rgba(15,23,42,0.6)",
      
      primary: "#059669",
      primaryGlow: "rgba(5,150,105,0.3)",
      primaryMuted: "rgba(5,150,105,0.1)",
      
      secondary: "#0284c7",
      secondaryMuted: "rgba(2,132,199,0.1)",
      
      success: "#059669",
      warning: "#d97706",
      danger: "#dc2626",
      
      border: "rgba(15,23,42,0.1)",
      card: "#ffffff",
      cardHover: "rgba(15,23,42,0.05)",
      
      hexOwned: "#059669",
      hexEnemy: "#dc2626",
      hexNeutral: "rgba(15,23,42,0.1)",
      hexUnexplored: "rgba(15,23,42,0.03)",
      hexContested: "#d97706",
    },
  },
  nature: {
    id: "nature",
    name: "自然健康",
    nameEn: "Nature",
    description: "柔和的绿色健康主题",
    isDark: true,
    colors: {
      background: "#1a2e1a",
      backgroundSecondary: "#243524",
      foreground: "#e8f5e8",
      foregroundMuted: "rgba(232,245,232,0.6)",
      
      primary: "#4ade80",
      primaryGlow: "rgba(74,222,128,0.4)",
      primaryMuted: "rgba(74,222,128,0.2)",
      
      secondary: "#86efac",
      secondaryMuted: "rgba(134,239,172,0.2)",
      
      success: "#4ade80",
      warning: "#fbbf24",
      danger: "#f87171",
      
      border: "rgba(232,245,232,0.15)",
      card: "rgba(36,53,36,0.6)",
      cardHover: "rgba(232,245,232,0.1)",
      
      hexOwned: "#4ade80",
      hexEnemy: "#f87171",
      hexNeutral: "rgba(232,245,232,0.1)",
      hexUnexplored: "rgba(232,245,232,0.03)",
      hexContested: "#fbbf24",
    },
  },
  custom: {
    id: "custom",
    name: "自定义",
    nameEn: "Custom",
    description: "创建你的专属主题",
    isDark: true,
    colors: {
      // Default to cyberpunk, will be overridden
      background: "#0f172a",
      backgroundSecondary: "#1e293b",
      foreground: "#ffffff",
      foregroundMuted: "rgba(255,255,255,0.6)",
      primary: "#22c55e",
      primaryGlow: "rgba(34,197,94,0.5)",
      primaryMuted: "rgba(34,197,94,0.2)",
      secondary: "#06b6d4",
      secondaryMuted: "rgba(6,182,212,0.2)",
      success: "#22c55e",
      warning: "#f59e0b",
      danger: "#ef4444",
      border: "rgba(255,255,255,0.1)",
      card: "rgba(0,0,0,0.4)",
      cardHover: "rgba(255,255,255,0.1)",
      hexOwned: "#22c55e",
      hexEnemy: "#ef4444",
      hexNeutral: "rgba(255,255,255,0.1)",
      hexUnexplored: "rgba(255,255,255,0.02)",
      hexContested: "#eab308",
    },
  },
}

// ============================================================
// Theme Context
// ============================================================

interface ThemeContextType {
  theme: Theme
  themeId: ThemeId
  setTheme: (id: ThemeId) => void
  customColors: Partial<ThemeColors>
  setCustomColor: (key: keyof ThemeColors, value: string) => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return context
}

// ============================================================
// Theme Provider Component
// ============================================================

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: ThemeId
}

export function ThemeProvider({ children, defaultTheme = "cyberpunk" }: ThemeProviderProps) {
  const [themeId, setThemeId] = useState<ThemeId>(defaultTheme)
  const [customColors, setCustomColors] = useState<Partial<ThemeColors>>({})
  const customColorsRef = useRef(customColors)
  customColorsRef.current = customColors

  // Load saved theme from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("citylord-theme")
    if (saved && (saved in themes)) {
      setThemeId(saved as ThemeId)
    }
    const savedCustom = localStorage.getItem("citylord-custom-colors")
    if (savedCustom) {
      setCustomColors(JSON.parse(savedCustom))
    }
  }, [])

  const setTheme = useCallback((id: ThemeId) => {
    setThemeId(id)
    localStorage.setItem("citylord-theme", id)
  }, [])

  const setCustomColor = useCallback((key: keyof ThemeColors, value: string) => {
    setCustomColors(prev => {
      const updated = { ...prev, [key]: value }
      localStorage.setItem("citylord-custom-colors", JSON.stringify(updated))
      return updated
    })
  }, [])

  // Get current theme with custom colors applied
  const theme: Theme = React.useMemo(() => ({
    ...themes[themeId],
    colors: {
      ...themes[themeId].colors,
      ...(themeId === "custom" ? customColorsRef.current : {}),
    },
  }), [themeId])

  // Apply CSS variables and DOM classes
  useEffect(() => {
    const root = document.documentElement
    
    // 1. CSS Variables (Standard Tailwind)
    const vars = {
      // ... (keep existing custom colors logic if needed, or rely on classes)
    }
    
    // 2. Class List Management
    root.classList.remove('theme-light', 'theme-nature') // Clean up
    if (themeId === 'light') root.classList.add('theme-light')
    if (themeId === 'nature') root.classList.add('theme-nature')
    
    // 3. Meta Theme Color
    // Use theme.colors.background as the theme color
    const metaThemeColor = document.querySelector('meta[name="theme-color"]')
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme.colors.background)
    } else {
      const meta = document.createElement('meta')
      meta.name = 'theme-color'
      meta.content = theme.colors.background
      document.head.appendChild(meta)
    }

    // 4. Capacitor Status Bar
    if (Capacitor.isNativePlatform()) {
      const isDarkTheme = theme.isDark
      // Style.Dark -> Light text (for dark backgrounds)
      // Style.Light -> Dark text (for light backgrounds)
      StatusBar.setStyle({ style: isDarkTheme ? Style.Dark : Style.Light })
      StatusBar.setBackgroundColor({ color: theme.colors.background })
      
      if (Capacitor.getPlatform() === 'android') {
        StatusBar.setOverlaysWebView({ overlay: false })
      }
    }

    // Custom colors application (existing logic)
    Object.entries(theme.colors).forEach(([key, value]) => {
      // We can map these to CSS variables if we want detailed control
      // For now, let's stick to the class-based approach for main theme
      // but maybe set specific variables for map colors?
      root.style.setProperty(`--theme-${key}`, value)
    })
    
  }, [theme, themeId])

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = React.useMemo(() => ({
    theme,
    themeId,
    setTheme,
    customColors,
    setCustomColor,
  }), [themeId, theme, customColors, setTheme, setCustomColor])

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  )
}

// ============================================================
// Theme Switcher UI Component
// ============================================================

interface ThemeSwitcherProps {
  isOpen: boolean
  onClose: () => void
}

export function ThemeSwitcher({ isOpen, onClose }: ThemeSwitcherProps) {
  const { themeId, setTheme, customColors, setCustomColor, theme } = useTheme()
  const [showCustomizer, setShowCustomizer] = useState(false)

  if (!isOpen) return null

  const presetColors = [
    "#22c55e", "#059669", "#06b6d4", "#3b82f6", 
    "#8b5cf6", "#ec4899", "#f59e0b", "#ef4444"
  ]

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md rounded-t-3xl border-t p-6"
        style={{ 
          backgroundColor: theme.colors.backgroundSecondary,
          borderColor: theme.colors.border,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div 
          className="mx-auto mb-4 h-1 w-12 rounded-full"
          style={{ backgroundColor: theme.colors.foregroundMuted }}
        />

        <h2 
          className="mb-4 text-center text-lg font-bold"
          style={{ color: theme.colors.foreground }}
        >
          主题设置
        </h2>

        {!showCustomizer ? (
          <>
            {/* Theme Grid */}
            <div className="mb-4 grid grid-cols-2 gap-3">
              {(Object.values(themes) as Theme[]).map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => {
                    if (theme.id === "custom") {
                      setShowCustomizer(true)
                    } else {
                      setTheme(theme.id)
                    }
                  }}
                  className={`relative overflow-hidden rounded-2xl border p-4 text-left transition-all ${
                    themeId === theme.id 
                      ? "ring-2 ring-offset-2" 
                      : "hover:scale-[1.02]"
                  }`}
                  style={{
                    backgroundColor: theme.colors.background,
                    borderColor: themeId === theme.id ? theme.colors.primary : theme.colors.border,
                    '--tw-ring-color': theme.colors.primary,
                    '--tw-ring-offset-color': theme.colors.background,
                  } as React.CSSProperties}
                >
                  {/* Color preview dots */}
                  <div className="mb-2 flex gap-1">
                    <div 
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: theme.colors.primary }}
                    />
                    <div 
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: theme.colors.secondary }}
                    />
                    <div 
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: theme.colors.warning }}
                    />
                  </div>
                  
                  <p 
                    className="font-semibold"
                    style={{ color: theme.colors.foreground }}
                  >
                    {theme.name}
                  </p>
                  <p 
                    className="text-xs"
                    style={{ color: theme.colors.foregroundMuted }}
                  >
                    {theme.description}
                  </p>

                  {/* Selected indicator */}
                  {themeId === theme.id && (
                    <div 
                      className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full"
                      style={{ backgroundColor: theme.colors.primary }}
                    >
                      <svg className="h-3 w-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Custom Theme Editor */}
            <button
              onClick={() => setShowCustomizer(false)}
              className="mb-4 text-sm"
              style={{ color: theme.colors.primary }}
            >
              ← 返回主题列表
            </button>

            <div className="space-y-4">
              {/* Primary Color */}
              <div>
                <p 
                  className="mb-2 text-sm font-medium"
                  style={{ color: theme.colors.foreground }}
                >
                  主色调
                </p>
                <div className="flex flex-wrap gap-2">
                  {presetColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        setCustomColor("primary", color)
                        setCustomColor("primaryGlow", `${color}80`)
                        setCustomColor("primaryMuted", `${color}33`)
                        setCustomColor("success", color)
                        setCustomColor("hexOwned", color)
                        setTheme("custom")
                      }}
                      className={`h-8 w-8 rounded-full transition-all ${
                        customColors.primary === color ? "ring-2 ring-offset-2" : ""
                      }`}
                      style={{
                        backgroundColor: color,
                        '--tw-ring-color': color,
                        '--tw-ring-offset-color': theme.colors.background,
                      } as React.CSSProperties}
                    />
                  ))}
                </div>
              </div>

              {/* Background Toggle */}
              <div>
                <p 
                  className="mb-2 text-sm font-medium"
                  style={{ color: theme.colors.foreground }}
                >
                  背景模式
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setCustomColor("background", "#0f172a")
                      setCustomColor("backgroundSecondary", "#1e293b")
                      setCustomColor("foreground", "#ffffff")
                      setCustomColor("foregroundMuted", "rgba(255,255,255,0.6)")
                      setTheme("custom")
                    }}
                    className="flex-1 rounded-xl border py-2 text-sm font-medium"
                    style={{
                      backgroundColor: "#0f172a",
                      borderColor: theme.colors.border,
                      color: "#ffffff",
                    }}
                  >
                    深色
                  </button>
                  <button
                    onClick={() => {
                      setCustomColor("background", "#f8fafc")
                      setCustomColor("backgroundSecondary", "#ffffff")
                      setCustomColor("foreground", "#0f172a")
                      setCustomColor("foregroundMuted", "rgba(15,23,42,0.6)")
                      setTheme("custom")
                    }}
                    className="flex-1 rounded-xl border py-2 text-sm font-medium"
                    style={{
                      backgroundColor: "#f8fafc",
                      borderColor: theme.colors.border,
                      color: "#0f172a",
                    }}
                  >
                    浅色
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-xl py-3 text-sm font-medium transition-all"
          style={{ 
            backgroundColor: theme.colors.primaryMuted,
            color: theme.colors.primary 
          }}
        >
          完成
        </button>
      </div>
    </div>
  )
}
