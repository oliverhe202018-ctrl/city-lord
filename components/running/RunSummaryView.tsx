"use client"

import { Share2, X, Activity, Flame, Zap, MapPin, Footprints, Timer, Trophy, Share, MessageCircle, MoreHorizontal, Camera, Loader2, CheckCircle2, Image as ImageIcon } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { HEX_AREA_SQ_METERS } from "@/lib/citylord/area-utils"
import dynamic from "next/dynamic"
import { MapSkeleton } from "@/components/map/MapSkeleton"

const StaticTrajectoryMap = dynamic(
  () => import("./StaticTrajectoryMap").then(mod => mod.StaticTrajectoryMap),
  { ssr: false, loading: () => <MapSkeleton className="w-full h-full bg-slate-900 rounded-2xl" /> }
)
import { useState, useRef } from "react"
import { GlassCard } from "../ui/GlassCard"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { createPost } from "@/app/actions/social-hub"
import { useGameStore } from "@/store/useGameStore"

interface RunSummaryViewProps {
  distanceMeters: number // meters (raw)
  durationSeconds: number // seconds (raw)
  duration: string // "HH:MM:SS" (formatted, for display)
  pace: string // "MM'SS""
  calories: number
  hexesCaptured: number
  steps?: number
  onClose: () => void
  onShare?: () => void
  runTrajectory?: { lat: number, lng: number }[]
  territoryInfo?: {
    isCaptured: boolean
    previousOwner?: string
  }
  runId?: string // Run ID for photo upload and sharing
}

export function RunSummaryView({
  distanceMeters,
  durationSeconds,
  duration,
  pace,
  calories,
  hexesCaptured,
  steps = 0,
  onClose,
  onShare,
  runTrajectory = [],
  territoryInfo = { isCaptured: false },
  runId
}: RunSummaryViewProps) {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [hasShared, setHasShared] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const userId = useGameStore(state => state.userId);

  // Compute average speed from raw values (no string parsing)
  const avgSpeed = durationSeconds > 0
    ? ((distanceMeters / durationSeconds) * 3.6).toFixed(1)
    : '--';

  // Distance in km for display
  const distanceKm = (distanceMeters / 1000).toFixed(2);

  // Calculate territory area based on game constants
  const capturedArea = hexesCaptured * HEX_AREA_SQ_METERS

  const forceExit = (e?: any) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (onClose) {
      onClose();
    } else {
      window.location.replace('/');
    }
  };

  // Photo upload handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    setIsUploading(true);
    try {
      const supabase = createClient();
      const fileExt = file.name.split('.').pop();
      const filePath = `run-photos/${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;
      setPhotoUrl(publicUrl);

      // Save photo_url to the run record if we have a runId
      if (runId) {
        // Use untyped update since photo_url may not be in Prisma types yet
        await (supabase
          .from('runs') as any)
          .update({ photo_url: publicUrl })
          .eq('id', runId);
      }

      toast.success('照片添加成功！');
    } catch (err) {
      console.error('Photo upload failed:', err);
      toast.error('照片上传失败，请重试');
    } finally {
      setIsUploading(false);
    }
  };

  // Share to feed handler
  const handleShareToFeed = async () => {
    if (isSharing || hasShared) return;
    setIsSharing(true);
    try {
      const content = [
        `🏃 完成一次跑步！`,
        `📏 距离: ${distanceKm} km`,
        `⏱️ 用时: ${duration}`,
        `🎯 配速: ${pace}`,
        `🔥 消耗: ${calories} Kcal`,
        `👟 步数: ${steps}`,
        hexesCaptured > 0 ? `🏰 占领领地: ${hexesCaptured * 650}㎡` : null,
        avgSpeed !== '--' ? `💨 平均速度: ${avgSpeed} km/h` : null,
      ].filter(Boolean).join('\n');

      const mediaUrls = photoUrl ? [photoUrl] : [];

      const result = await createPost({
        content,
        source_type: 'RUN',
        source_id: runId || undefined,
        mediaUrls,
        visibility: 'PUBLIC'
      });

      if (result.success) {
        toast.success('已分享到动态！');
        setHasShared(true);
        setIsShareModalOpen(false);
      } else {
        throw new Error(result.error?.message || '分享失败');
      }
    } catch (err: any) {
      console.error('Share to feed failed:', err);
      if (err?.message?.includes('429') || err?.message?.includes('频繁')) {
        toast.error('操作过于频繁，请稍后再试');
      } else {
        toast.error('分享失败，请重试');
      }
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col bg-white text-black animate-in slide-in-from-bottom duration-300">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoUpload}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-yellow-400 flex items-center justify-center text-white font-bold">
            CL
          </div>
          <div>
            <div className="text-xs text-gray-500">来源: CityLord</div>
            <div className="text-sm font-bold text-[#22c55e]">户外跑步</div>
          </div>
        </div>
        <div
          onClick={forceExit}
          className="p-2 text-gray-400 hover:bg-gray-100 rounded-full cursor-pointer z-50 pointer-events-auto"
        >
          <X size={20} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50/50">
        {/* Main Stat: Distance */}
        <div className="pt-8 pb-4 text-center">
          <div className="text-[5rem] leading-none font-bold text-gray-900 tracking-tighter">
            {distanceKm}
          </div>
          <div className="text-gray-500 text-sm mt-1">公里</div>
        </div>

        {/* Divider / Info */}
        <div className="flex justify-center items-center gap-2 mb-8">
          <div className="h-[1px] w-12 bg-gray-200"></div>
          <div className="text-xs text-[#22c55e]">这是第 N 次跑步</div>
          <div className="h-[1px] w-12 bg-gray-200"></div>
        </div>

        {/* Stats Grid 3x2 */}
        <div className="grid grid-cols-3 gap-y-8 px-4 mb-8">
          {/* Avg Pace */}
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{pace}</div>
            <div className="text-xs text-gray-400 mt-1">平均配速</div>
          </div>
          {/* Duration */}
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{duration}</div>
            <div className="text-xs text-gray-400 mt-1">运动时长</div>
          </div>
          {/* Calories */}
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{calories}</div>
            <div className="text-xs text-gray-400 mt-1">消耗热量(Kcal)</div>
          </div>

          {/* Speed */}
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{avgSpeed}</div>
            <div className="text-xs text-gray-400 mt-1">速度(km/h)</div>
          </div>
          {/* Steps / Stride */}
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{steps}</div>
            <div className="text-xs text-gray-400 mt-1">步数</div>
          </div>
          {/* Territory Captured - RED FONT */}
          <div className="text-center">
            <div className="text-2xl font-bold text-red-500">{hexesCaptured * 650}</div>
            <div className="text-xs text-gray-400 mt-1">领地占领㎡</div>
          </div>
        </div>

        {/* Achievement / Result Badges */}
        <div className="bg-white mx-4 rounded-xl p-4 shadow-sm mb-4">
          <div className="text-sm font-bold text-gray-900 mb-4">运动成果</div>

          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-600">
              用时{duration}，刷新了单次最长跑步时间
            </div>
            <Trophy className="h-5 w-5 text-yellow-500" />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              占领了 {hexesCaptured} 块新领地
            </div>
            <MapPin className="h-5 w-5 text-red-400" />
          </div>
        </div>

        {/* Photo Upload Section */}
        <div className="mx-4 mb-4">
          {photoUrl ? (
            <div className="relative w-full bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
              <img src={photoUrl} alt="跑步照片" className="w-full h-48 object-cover" />
              <div className="absolute top-2 right-2">
                <CheckCircle2 className="w-6 h-6 text-green-500 bg-white rounded-full" />
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 text-xs text-gray-500 hover:bg-gray-50 transition-colors border-t border-gray-100"
              >
                更换照片
              </button>
            </div>
          ) : (
            <button
              className="w-full bg-white rounded-xl p-4 shadow-sm flex flex-col items-center justify-center gap-2 border border-dashed border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
                  <span className="text-sm font-medium text-gray-600">上传中...</span>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <Camera className="w-5 h-5 text-gray-500" />
                  </div>
                  <span className="text-sm font-medium text-gray-600">添加照片</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Static Trajectory Map */}
        <div className="mx-4 mb-4 rounded-xl overflow-hidden shadow-sm border border-gray-100 relative bg-gray-100 h-72">
          {runTrajectory && runTrajectory.length > 0 ? (
            <StaticTrajectoryMap path={runTrajectory} className="w-full h-full" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
              暂无轨迹数据
            </div>
          )}
        </div>

        {/* Territory Capture Feedback */}
        {territoryInfo.isCaptured && (
          <div className="mx-4 mb-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
            <div className="inline-block px-4 py-2 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/20">
              <span className="text-[#22c55e] font-bold text-sm">
                {territoryInfo.previousOwner
                  ? `恭喜，本次从 ${territoryInfo.previousOwner} 手中占领1块领地`
                  : "恭喜，本次占领1块新领地"
                }
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="p-4 bg-white border-t border-gray-100 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold py-3 rounded-full transition-all active:scale-[0.98] text-center flex items-center justify-center cursor-pointer z-50 pointer-events-auto"
          >
            完成运动
          </button>
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold py-3 rounded-full transition-all active:scale-[0.98]"
          >
            分享战绩
          </button>
        </div>
      </div>

      {/* Share Modal */}
      <AnimatePresence>
        {isShareModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsShareModalOpen(false)}
              className="fixed inset-0 bg-black/50 z-[10001] backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-[10002] p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-gray-900">分享战绩</h3>
                <button
                  onClick={() => setIsShareModalOpen(false)}
                  className="p-1 rounded-full hover:bg-gray-100"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={handleShareToFeed}
                  disabled={isSharing || hasShared}
                  className="flex flex-col items-center gap-3 p-4 rounded-xl bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center text-white ${hasShared ? 'bg-gray-400' : 'bg-[#22c55e]'}`}>
                    {isSharing ? (
                      <Loader2 size={24} className="animate-spin" />
                    ) : hasShared ? (
                      <CheckCircle2 size={24} />
                    ) : (
                      <MessageCircle size={24} fill="currentColor" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {hasShared ? '已分享' : '分享到动态'}
                  </span>
                </button>

                <button
                  onClick={() => {
                    toast.success("更多分享方式开发中");
                    setIsShareModalOpen(false);
                  }}
                  className="flex flex-col items-center gap-3 p-4 rounded-xl bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <div className="h-12 w-12 rounded-full bg-blue-500 flex items-center justify-center text-white">
                    <MoreHorizontal size={24} />
                  </div>
                  <span className="text-sm font-medium text-gray-900">其他分享</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
