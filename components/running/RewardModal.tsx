"use client"

import { useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useGameStore } from "@/store/useGameStore"
import { X, Star, Zap, Coins, TrendingUp, Trophy } from "lucide-react"
import { Dialog, DialogContent, DialogOverlay } from "@radix-ui/react-dialog"

interface RewardData {
  leveledUp: boolean
  newLevel: number
  rewardSummary: {
    totalPoints: number
    totalLevelXp: number
    maxAreaMultiplier: number
  }
}

export function RewardModal() {
  const { showRewardModal, currentRewardData, closeRewardModal } = useGameStore()

  const rewardData = currentRewardData as RewardData | null

  // Auto close modal after 5 seconds
  useEffect(() => {
    if (showRewardModal) {
      const timer = setTimeout(() => {
        closeRewardModal()
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [showRewardModal, closeRewardModal])

  if (!rewardData) return null

  const { leveledUp, newLevel, rewardSummary } = rewardData

  return (
    <AnimatePresence>
      {showRewardModal && (
        <Dialog open={showRewardModal} onOpenChange={closeRewardModal}>
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
              <div className="relative bg-gradient-to-br from-purple-900/90 via-blue-900/90 to-indigo-900/90 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl overflow-hidden">
                {/* Close Button */}
                <button
                  onClick={closeRewardModal}
                  className="absolute right-4 top-4 z-10 rounded-full p-2 bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <X className="h-4 w-4 text-white" />
                </button>

                {/* Header */}
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
                    跑步奖励结算
                  </motion.h2>
                  
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-blue-200 text-sm"
                  >
                    恭喜完成本次跑步！
                  </motion.p>
                </div>

                {/* Level Up Animation */}
                <AnimatePresence>
                  {leveledUp && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.2 }}
                      transition={{ 
                        type: "spring", 
                        stiffness: 500, 
                        damping: 15,
                        delay: 0.4
                      }}
                      className="bg-gradient-to-r from-yellow-400/20 to-orange-400/20 border-y border-yellow-400/30 mx-6 rounded-lg p-4 mb-4"
                    >
                      <motion.div
                        animate={{ 
                          scale: [1, 1.2, 1],
                          rotate: [0, 5, -5, 0]
                        }}
                        transition={{ 
                          duration: 0.6,
                          repeat: Infinity,
                          repeatDelay: 2
                        }}
                        className="flex items-center justify-center gap-3"
                      >
                        <Star className="h-8 w-8 text-yellow-400 fill-current" />
                        <span className="text-xl font-bold text-yellow-400">
                          等级提升！
                        </span>
                        <Star className="h-8 w-8 text-yellow-400 fill-current" />
                      </motion.div>
                      
                      <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="text-center text-yellow-300 font-semibold mt-2"
                      >
                        现在等级：{newLevel}
                      </motion.p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Rewards List */}
                <div className="px-6 pb-6 space-y-3">
                  {/* Points */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex items-center justify-between p-3 bg-white/5 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <Coins className="h-6 w-6 text-yellow-400" />
                      <span className="text-white font-medium">获得点数</span>
                    </div>
                    <span className="text-yellow-400 font-bold text-lg">
                      +{rewardSummary.totalPoints}
                    </span>
                  </motion.div>

                  {/* Experience */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 }}
                    className="flex items-center justify-between p-3 bg-white/5 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <Zap className="h-6 w-6 text-blue-400" />
                      <span className="text-white font-medium">经验值</span>
                    </div>
                    <span className="text-blue-400 font-bold text-lg">
                      +{rewardSummary.totalLevelXp}
                    </span>
                  </motion.div>

                  {/* Area Multiplier */}
                  {rewardSummary.maxAreaMultiplier > 1 && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.7 }}
                      className="flex items-center justify-between p-3 bg-white/5 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <TrendingUp className="h-6 w-6 text-green-400" />
                        <span className="text-white font-medium">面积加成</span>
                      </div>
                      <span className="text-green-400 font-bold text-lg">
                        {rewardSummary.maxAreaMultiplier}x
                      </span>
                    </motion.div>
                  )}
                </div>

                {/* Footer */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="px-6 pb-6"
                >
                  <button
                    onClick={closeRewardModal}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-blue-600 hover:to-purple-700 transition-all active:scale-95"
                  >
                    确认
                  </button>
                </motion.div>
              </div>
            </motion.div>
          </DialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  )
}