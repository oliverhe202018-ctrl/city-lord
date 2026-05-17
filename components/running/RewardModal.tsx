"use client"

import { useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useGameStore } from "@/store/useGameStore"
import type { CelebrationEvent } from "@/store/useGameStore"
import { X, Star, Trophy, Award } from "lucide-react"
import { Dialog, DialogContent, DialogOverlay } from "@radix-ui/react-dialog"

interface CelebrationRendererProps {
  event: CelebrationEvent
  onClose: () => void
}

function CelebrationRenderer({ event, onClose }: CelebrationRendererProps) {
  const { type, payload } = event

  if (type === 'LEVEL_UP') {
    const { oldLevel, newLevel, newTitle } = payload as { oldLevel: number; newLevel: number; newTitle: string }
    return (
      <div className="relative bg-gradient-to-br from-purple-900/90 via-blue-900/90 to-indigo-900/90 backdrop-blur-xl rounded-3xl border border-yellow-400/30 shadow-2xl overflow-hidden">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full p-2 bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X className="h-4 w-4 text-white" />
        </button>

        <div className="p-6 pb-4 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.1 }}
            className="mx-auto mb-4"
          >
            <Trophy className="h-16 w-16 text-yellow-400 mx-auto" />
          </motion.div>
          
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold text-white mb-2"
          >
            等级提升！
          </motion.h2>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 15, delay: 0.3 }}
            className="bg-gradient-to-r from-yellow-400/20 to-orange-400/20 border border-yellow-400/30 rounded-lg p-4 mb-4"
          >
            <div className="flex items-center justify-center gap-3">
              <Star className="h-8 w-8 text-yellow-400 fill-current" />
              <span className="text-xl font-bold text-yellow-400">
                Lv.{oldLevel} → Lv.{newLevel}
              </span>
              <Star className="h-8 w-8 text-yellow-400 fill-current" />
            </div>
          </motion.div>

          {newTitle && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-yellow-300 font-semibold"
            >
              解锁称号：{newTitle}
            </motion.p>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="px-6 pb-6"
        >
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 text-white py-3 rounded-xl font-semibold hover:from-yellow-600 hover:to-orange-700 transition-all active:scale-95"
          >
            太棒了！
          </button>
        </motion.div>
      </div>
    )
  }

  if (type === 'BADGE' || type === 'NEW_TITLE') {
    const { badgeName, badgeIcon, titleName } = payload as { badgeName?: string; badgeIcon?: string; titleName?: string }
    const displayName = badgeName || titleName || '未知奖励'
    
    return (
      <div className="relative bg-gradient-to-br from-emerald-900/90 via-teal-900/90 to-cyan-900/90 backdrop-blur-xl rounded-3xl border border-emerald-400/30 shadow-2xl overflow-hidden">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full p-2 bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X className="h-4 w-4 text-white" />
        </button>

        <div className="p-6 pb-4 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.1 }}
            className="mx-auto mb-4"
          >
            <Award className="h-16 w-16 text-emerald-400 mx-auto" />
          </motion.div>
          
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold text-white mb-2"
          >
            {type === 'NEW_TITLE' ? '解锁新称号' : '获得徽章'}
          </motion.h2>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-emerald-300 font-semibold text-lg"
          >
            {displayName}
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="px-6 pb-6"
        >
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3 rounded-xl font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all active:scale-95"
          >
            确认
          </button>
        </motion.div>
      </div>
    )
  }

  return null
}

export function CelebrationOrchestrator() {
  const celebrationQueue = useGameStore((state) => state.celebrationQueue)
  const dequeueCelebration = useGameStore((state) => state.dequeueCelebration)

  const currentCelebration = celebrationQueue.length > 0 ? celebrationQueue[0] : null

  const handleClose = useCallback(() => {
    dequeueCelebration()
  }, [dequeueCelebration])

  return (
    <AnimatePresence>
      {currentCelebration && (
        <Dialog open={true} onOpenChange={handleClose}>
          <DialogOverlay asChild>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
          </DialogOverlay>
          
          <DialogContent asChild>
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 p-6"
            >
              <CelebrationRenderer event={currentCelebration} onClose={handleClose} />
            </motion.div>
          </DialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  )
}
