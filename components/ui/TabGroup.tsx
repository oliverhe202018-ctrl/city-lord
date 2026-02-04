'use client'

import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

export interface TabItem {
  id: string
  label: string
}

interface TabGroupProps {
  items: TabItem[]
  activeId: string
  onChange: (id: string) => void
  variant?: 'minimal' | 'block'
  className?: string
}

export function TabGroup({ 
  items, 
  activeId, 
  onChange, 
  variant = 'minimal',
  className 
}: TabGroupProps) {
  return (
    <div className={cn(
      "w-full bg-gray-800/50 rounded-lg p-1",
      className
    )}>
      <div className="grid grid-cols-3 gap-1 relative">
        {items.map((item) => {
          const isActive = activeId === item.id
          
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={cn(
                "relative flex items-center justify-center py-2 px-3 text-sm font-medium transition-colors duration-200 rounded-md outline-none",
                // Base text styles
                isActive 
                  ? (variant === 'minimal' ? "text-yellow-400" : "text-black font-bold")
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/5",
                // Z-index to ensure text is above background
                "z-10"
              )}
            >
              {/* Variant A: Minimal (Bottom Line + Glow) */}
              {variant === 'minimal' && isActive && (
                <motion.div
                  layoutId="activeTabMinimal"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}

              {/* Variant B: Block (Pill Background) */}
              {variant === 'block' && isActive && (
                <motion.div
                  layoutId="activeTabBlock"
                  className="absolute inset-0 bg-yellow-500 rounded-md -z-10"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}

              <span className="relative truncate">{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
