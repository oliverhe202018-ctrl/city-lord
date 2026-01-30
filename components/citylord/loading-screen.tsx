"use client"

import { motion } from "framer-motion"
import { Zap } from "lucide-react"

/**
 * LoadingScreen 组件
 * 全屏加载动画，带有品牌 Logo 的呼吸效果
 */

interface LoadingScreenProps {
  message?: string
  progress?: number
}

export function LoadingScreen({ message = "加载中...", progress }: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0f172a]">
      {/* Logo 和呼吸动画 */}
      <motion.div
        className="relative mb-8"
        animate={{
          scale: [1, 1.05, 1],
          opacity: [0.8, 1, 0.8],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        {/* 光晕效果 */}
        <motion.div
          className="absolute -inset-4 rounded-full bg-gradient-to-r from-[#22c55e]/20 to-[#3b82f6]/20 blur-xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.1,
          }}
        />

        {/* Logo 图标 */}
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#22c55e] to-[#3b82f6] shadow-lg">
          <Zap className="h-10 w-10 text-white" />
        </div>
      </motion.div>

      {/* 应用名称 */}
      <motion.h1
        className="mb-4 text-3xl font-bold text-white"
        animate={{
          opacity: [0.6, 1, 0.6],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.2,
        }}
      >
        城市领主
      </motion.h1>

      {/* 加载消息 */}
      <motion.p
        className="mb-6 text-sm text-white/60"
        animate={{
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.3,
        }}
      >
        {message}
      </motion.p>

      {/* 进度条（可选） */}
      {progress !== undefined && (
        <div className="w-64 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-2 rounded-full bg-gradient-to-r from-[#22c55e] to-[#3b82f6]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}

      {/* 加载动画点 */}
      <div className="mt-8 flex gap-2">
        {[0, 1, 2].map((index) => (
          <motion.div
            key={index}
            className="h-2 w-2 rounded-full bg-[#22c55e]"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.4, 1, 0.4],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: index * 0.2,
            }}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * LoadingSpinner 组件
 * 轻量级加载指示器，用于局部加载场景
 */
export function LoadingSpinner({ size = "md", className = "" }: { size?: "sm" | "md" | "lg", className?: string }) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  }

  return (
    <motion.div
      className={`relative ${sizeClasses[size]} ${className}`}
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
    >
      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#22c55e]" />
      <div className="absolute inset-1 rounded-full border-2 border-transparent border-t-[#3b82f6]" />
    </motion.div>
  )
}

/**
 * LoadingOverlay 组件
 * 半透明加载遮罩，用于内容区域加载
 */
export function LoadingOverlay({ message = "加载中...", blur = true }: { message?: string, blur?: boolean }) {
  return (
    <div
      className={`absolute inset-0 z-50 flex items-center justify-center bg-[#0f172a]/80 ${
        blur ? "backdrop-blur-sm" : ""
      }`}
    >
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-white/80">{message}</p>
      </div>
    </div>
  )
}
