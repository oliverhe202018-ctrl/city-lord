"use client"

import { Share2, X, Activity, Flame, Zap, MapPin, Footprints, Timer, Trophy, Share, MessageCircle, MoreHorizontal, Camera, Loader2, CheckCircle2, Image as ImageIcon, ChevronRight } from "lucide-react"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { HEX_AREA_SQ_METERS, formatArea } from "@/lib/citylord/area-utils"
import dynamic from "next/dynamic"
import { MapSkeleton } from "@/components/map/MapSkeleton"

const StaticTrajectoryMap = dynamic(
  () => import("./StaticTrajectoryMap").then(mod => mod.StaticTrajectoryMap),
  { ssr: false, loading: () => <MapSkeleton className="w-full h-full bg-slate-900 rounded-2xl" /> }
)
import { useState, useRef, useEffect } from "react"
import { Portal } from "@radix-ui/react-portal"
import { GlassCard } from "../ui/GlassCard"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { createPost } from "@/app/actions/social-hub"
import { useGameStore } from "@/store/useGameStore"
import { generateRunStory } from "@/app/actions/story-service"
import { updateRunSummary, getRunSettlementStatus } from "@/app/actions/run-service"
import { Clipboard } from "@capacitor/clipboard"
import { isNativePlatform } from "@/lib/capacitor/safe-plugins"
import { useRouter } from "next/navigation"

interface RunSummaryViewProps {
  distanceMeters: number // meters (raw)
  durationSeconds: number // seconds (raw)
  duration: string // "HH:MM:SS" (formatted, for display)
  pace: string // "MM'SS""
  calories: number
  hexesCaptured: number
  steps?: number
  runIsValid?: boolean
  antiCheatLog?: string | null
  onClose: () => void
  onShare?: () => void
  runTrajectory?: { lat: number, lng: number }[]
  territoryInfo?: {
    isCaptured: boolean
    previousOwner?: string
  }
  runId?: string // Run ID for photo upload and sharing
  runNumber?: number // Phase 3: Dynamic run number
  damageSummary?: {
    ownerName: string;
    damage: number;
    territoryType: string;
    isDestroyed: boolean;
    isCritical?: boolean;
  }[]; // Phase 3: Damage details
  maintenanceSummary?: {
    territoryId: string;
    type: 'HEAL' | 'FORTIFY' | 'BOTH';
    oldMaxHp: number;
    newMaxHp: number;
    beforeHp: number;
    afterHp: number;
    level: number;
  }[]; // Phase 4: Maintenance details
  capturedArea?: number; // m² (optional, overrides hexesCaptured calculation)
}

export function RunSummaryView({
  distanceMeters,
  durationSeconds,
  duration,
  pace,
  calories,
  hexesCaptured,
  steps = 0,
  runIsValid = true,
  antiCheatLog,
  onClose,
  onShare,
  runTrajectory = [],
  territoryInfo = { isCaptured: false },
  runId,
  runNumber,
  damageSummary = [],
  maintenanceSummary = [],
  capturedArea: propCapturedArea
}: RunSummaryViewProps) {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [hasShared, setHasShared] = useState(false);
  const [showAntiCheatModal, setShowAntiCheatModal] = useState(false);
  const [showClubContributionFx, setShowClubContributionFx] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const userId = useGameStore(state => state.userId);
  const faction = useGameStore(state => state.faction);
  const clubId = useGameStore(state => state.clubId);
  const router = useRouter();

  // Settlement State
  const [settlementStats, setSettlementStats] = useState<{newTerritories: number; reinforcedTerritories: number} | null>(null);
  const [isSettlementLoading, setIsSettlementLoading] = useState(false);
  const [hasSettlementTimeout, setHasSettlementTimeout] = useState(false);

  useEffect(() => {
    if (!runId || !runIsValid) return;
    setIsSettlementLoading(true);
    let attempts = 0;
    const maxAttempts = 15; // 15 * 2s = 30s
    let intervalId: ReturnType<typeof setInterval>;
    
    const poll = async () => {
      attempts++;
      const res = await getRunSettlementStatus(runId);
      if (res.success && res.data && (res.data.newTerritories > 0 || res.data.reinforcedTerritories > 0)) {
        setSettlementStats(res.data);
        setIsSettlementLoading(false);
        if (intervalId) clearInterval(intervalId);
      } else if (attempts >= maxAttempts) {
        setIsSettlementLoading(false);
        setHasSettlementTimeout(true);
        if (intervalId) clearInterval(intervalId);
      }
    };
    
    intervalId = setInterval(poll, 2000);
    poll(); // initial call
    return () => clearInterval(intervalId);
  }, [runId, runIsValid]);

  // Storytelling State
  const [story, setStory] = useState<string | null>(null);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);

  const handleGenerateStory = async () => {
    if (isGeneratingStory) return;
    setIsGeneratingStory(true);
    try {
      const result = await generateRunStory({
        distanceMeters,
        durationSeconds,
        hexesCaptured,
        steps,
        pace
      }, faction || '未知阵营');
      if (!result.ok) {
        if (result.code === 'TIMEOUT') {
          toast.error('生成超时，请稍后重试');
        } else if (result.code === 'RATE_LIMIT') {
          toast.error('接口限流，请稍后重试');
        } else if (result.code === 'AUTH_MISSING') {
          toast.error('战报服务未配置 API Key');
        } else if (result.code === 'UPSTREAM_5XX') {
          toast.error('战报服务繁忙，请稍后重试');
        } else if (result.code === 'NETWORK_ERROR') {
          toast.error('网络异常，请稍后重试');
        } else {
          toast.error(result.message || '战报生成失败');
        }
        return;
      }
      setStory(result.story || '');
      
      // Auto-persist to DB if runId is available
      if (runId && result.story) {
        updateRunSummary(runId, result.story).catch(e => 
          console.error('[RunSummary] Persistence failed:', e)
        );
      }
      
      toast.success('史诗战报已谱写完成！');
    } catch (err) {
      console.error('Failed to generate story:', err);
      toast.error('AI 灵感枯竭，请稍后再试');
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const handleCopyStory = async () => {
    if (!story) return;
    try {
      if (await isNativePlatform()) {
        await Clipboard.write({ string: story });
      } else {
        await navigator.clipboard.writeText(story);
      }
      toast.success('AI 战报已复制到剪贴板！');
    } catch {
      toast.error('复制失败，请手动选取文字');
    }
  };

  // Compute average speed from raw values (no string parsing)
  const avgSpeed = durationSeconds > 0
    ? ((distanceMeters / durationSeconds) * 3.6).toFixed(1)
    : '--';
  const avgStride = steps > 0 ? (distanceMeters / steps).toFixed(2) : '--';

  // Distance in km for display
  const distanceKm = (distanceMeters / 1000).toFixed(2);

  useEffect(() => {
    if (!runIsValid) {
      setShowAntiCheatModal(true);
    }
  }, [runIsValid]);

  const finalCapturedArea = Math.max(0, Number.isFinite(propCapturedArea ?? 0) ? (propCapturedArea ?? 0) : 0);
  const contributedArea = Math.max(0, Math.round(finalCapturedArea));

  // Aggregate damage by owner for UI display
  const aggregatedDamage = damageSummary.reduce((acc, curr) => {
    const key = `${curr.ownerName}_${curr.isCritical ? 'crit' : 'norm'}`;
    if (!acc[key]) {
      acc[key] = { ownerName: curr.ownerName, totalDamage: 0, count: 0, isCritical: curr.isCritical };
    }
    acc[key].totalDamage += curr.damage;
    acc[key].count += 1;
    return acc;
  }, {} as Record<string, { ownerName: string, totalDamage: number, count: number, isCritical?: boolean }>);

  const forceExit = (e?: any) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    onClose();
  };

  // Photo upload handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    setIsUploading(true);
    const fileExt = file.name.split('.').pop();
    const filePath = `${userId}/${Date.now()}.${fileExt}`;
    const startTime = Date.now();
    let attempt = 0;
    const maxAttempts = 3;

    try {
      const supabase = createClient();
      let uploadResult;

      console.log(`[Upload] Starting upload for ${filePath} to run-photos bucket...`);

      while (attempt < maxAttempts) {
        attempt++;
        try {
          console.log(`[Upload] Attempt ${attempt}`);
          const attemptStart = Date.now();
          const abortController = new AbortController();
          
          uploadResult = await Promise.race([
            // Use standard fetch options for signals in V2 client
            supabase.storage.from('run-photos').upload(filePath, file, { 
              cacheControl: '3600',
              upsert: true,
              ...( { signal: abortController.signal } as any )
            }),
            new Promise<never>((_, reject) => 
              setTimeout(() => {
                abortController.abort('UPLOAD_TIMEOUT');
                reject(new Error('UPLOAD_TIMEOUT'));
              }, 30000)
            )
          ]);
          
          if (uploadResult?.error) {
            // Log specific Supabase error details
            console.error(`[Upload] Supabase Error Details:`, {
              message: uploadResult.error.message,
              name: (uploadResult.error as any).name,
              status: (uploadResult.error as any).status,
              path: filePath
            });
            throw uploadResult.error;
          }
          
          console.log(`[Upload] Attempt ${attempt} succeeded in ${Date.now() - attemptStart}ms`);
          break; // Success, exit retry loop
        } catch (err: any) {
          console.error(`[Upload] Attempt ${attempt} failed with Error:`, err);
          
          // Provide hint for RLS errors which often show up as 403 or generic error
          if (err?.message?.includes('policies') || err?.status === 403) {
            console.error(`[Upload] This looks like a Supabase RLS Policy issue. Check 'run-photos' bucket permissions.`);
          }

          if (attempt >= maxAttempts) throw err;
          
          // Exponential backoff: 2s, 4s
          const backoff = Math.pow(2, attempt) * 1000;
          console.log(`[Upload] Waiting ${backoff}ms before retry...`);
          await new Promise(r => setTimeout(r, backoff));
        }
      }

      const { data: urlData } = supabase.storage
        .from('run-photos')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;
      setPhotoUrl(publicUrl);

      // Save photo_url to the run record if we have a runId
      if (runId) {
        const { error: updateError } = await (supabase
          .from('runs') as any)
          .update({ photo_url: publicUrl })
          .eq('id', runId);
          
        if (updateError) {
          console.error(`[Upload] Failed to update run record with photo URL:`, updateError);
          // We don't throw here because the photo was uploaded successfully to storage
        }
      }

      console.log(`[Upload] Fully completed in ${Date.now() - startTime}ms. URL: ${publicUrl}`);
      toast.success('照片添加成功！');
    } catch (err: any) {
      console.error(`[Upload] Permanently failed after ${attempt} attempts. Total time: ${Date.now() - startTime}ms. Final Error:`, {
        message: err?.message,
        stack: err?.stack,
        details: err
      });
      
      const errorMessage = err?.message === 'UPLOAD_TIMEOUT' 
        ? '上传超时，请检查网络后重试' 
        : `照片上传失败: ${err?.message || '请重试'}`;
        
      toast.error(errorMessage);
    } finally {
      setIsUploading(false); // State Machine Guarantee
    }
  };

  // Share to feed handler — 直接调用 createPost API，无 Draft 中转
  const handleShareToFeed = async () => {
    if (isSharing || hasShared) return;
    if (!runId) {
      toast.error('跑步数据未保存，无法分享');
      return;
    }
    setIsSharing(true);
    try {
      const summaryLines = [
        `🏃 完成一次跑步！`,
        `📏 距离: ${distanceKm} km`,
        `⏱️ 用时: ${duration}`,
        `🎯 配速: ${pace}`,
        `🔥 消耗: ${calories} Kcal`,
        hexesCaptured > 0 ? `🏰 占领领地: ${formatArea(finalCapturedArea).fullText}` : null,
        avgSpeed !== '--' ? `💨 平均速度: ${avgSpeed} km/h` : null,
      ].filter(Boolean).join('\n');

      const content = (story || summaryLines).slice(0, 500);

      const res = await createPost({
        content,
        source_type: 'RUN',
        source_id: runId,
        mediaUrls: photoUrl ? [photoUrl] : [],
        visibility: 'PUBLIC',
      });

      if (!res.success) throw new Error(res.error?.message || '发布失败');
      setHasShared(true);
      toast.success('战绩已发布到动态圈！');
      onClose();
      router.push('/?tab=social');
    } catch (err: any) {
      toast.error(err.message || '分享失败，请重试');
    } finally {
      setIsSharing(false);
    }
  };

  useEffect(() => {
    if (!runIsValid || !clubId || contributedArea <= 0) {
      setShowClubContributionFx(false);
      return;
    }
    const triggerTimer = setTimeout(() => {
      setShowClubContributionFx(true);
    }, 300);
    const dismissTimer = setTimeout(() => {
      setShowClubContributionFx(false);
    }, 1900);
    return () => {
      clearTimeout(triggerTimer);
      clearTimeout(dismissTimer);
    };
  }, [clubId, contributedArea, runIsValid]);

  return (
    <Portal>
      <div className="fixed inset-0 z-[100000] flex flex-col bg-white text-black animate-in slide-in-from-bottom duration-300">
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
              <div className="flex flex-col">
                <h2 className="text-xl font-bold text-gray-900">
                  {runNumber ? `第 ${runNumber} 次跑步` : '跑步结束'}
                </h2>
                <p className="text-gray-500 text-xs">
                  {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
          </div>

          <div className="grid grid-cols-4 gap-y-8 px-4 mb-8">
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
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{avgStride}</div>
              <div className="text-xs text-gray-400 mt-1">平均步幅(m)</div>
            </div>
            {/* Territory Captured - RED FONT */}
            <div className="text-center">
              <div className="relative inline-flex flex-col items-center">
                <div className="text-2xl font-bold text-red-500">{formatArea(finalCapturedArea).fullText}</div>
                <AnimatePresence>
                  {showClubContributionFx && (
                    <motion.div
                      key={`club-contribution-${runId || 'current'}`}
                      initial={{ opacity: 0, y: 12, scale: 0.95 }}
                      animate={{ opacity: [0, 1, 1, 0], y: [12, 0, -10, -22], scale: [0.95, 1, 1, 0.98] }}
                      exit={{ opacity: 0, y: -26 }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                      className="pointer-events-none absolute -top-7 whitespace-nowrap text-xs font-black text-amber-400 animate-bounce"
                    >
                      {`Club Area +${contributedArea}m²`}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="text-xs text-gray-400 mt-1">领地占领</div>
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

            {isSettlementLoading ? (
              <div className="flex items-center justify-between mb-3 text-gray-500">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">后台结算处理中...</span>
                </div>
              </div>
            ) : hasSettlementTimeout ? (
              <div className="flex items-center justify-between mb-3 text-amber-600">
                <div className="text-sm">结算后台处理中，请稍后在记录中查看明细</div>
              </div>
            ) : (settlementStats || hexesCaptured > 0) ? (
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  占领了 <span className="font-bold">{settlementStats?.newTerritories ?? hexesCaptured}</span> 块新领地
                  {(settlementStats?.reinforcedTerritories ?? 0) > 0 ? `，加固了 ${settlementStats?.reinforcedTerritories} 块` : ''}
                </div>
                <MapPin className="h-5 w-5 text-red-400" />
              </div>
            ) : null}

            {/* Phase 3: Damage Results */}
            {Object.entries(aggregatedDamage).map(([key, data], idx) => (
              <div key={idx} className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                <div className="text-sm text-gray-600">
                  {data.isCritical ? (
                    <>
                      对 <span className="font-bold text-gray-900">{data.ownerName}</span> 的领地造成 <span className="font-bold text-red-600">{data.totalDamage} 点暴击伤害</span>
                    </>
                  ) : (
                    <>
                      对 <span className="font-bold text-gray-900">{data.ownerName}</span> 的领地造成 {data.totalDamage} 点伤害
                    </>
                  )}
                </div>
                {data.isCritical ? (
                  <Zap className="h-5 w-5 text-red-500 fill-red-500 animate-pulse" />
                ) : (
                  <Zap className="h-4 w-4 text-orange-500 fill-orange-500" />
                )}
              </div>
            ))}

            {/* Phase 4: Maintenance Results */}
            {maintenanceSummary && maintenanceSummary.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-50">
                {maintenanceSummary.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between mb-2 last:mb-0">
                    <div className="text-sm text-gray-600">
                      {item.type === 'FORTIFY' 
                        ? `加固领地成功，上限提升至 ${item.newMaxHp} HP`
                        : `回血成功，领地已恢复至 ${item.afterHp} HP`}
                    </div>
                    <Flame className="h-4 w-4 text-red-500 fill-red-500" />
                  </div>
                ))}
                {maintenanceSummary.length > 3 && (
                  <div className="text-[10px] text-gray-400 text-center mt-1">
                    ...以及其他 {maintenanceSummary.length - 3} 处加固
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Photo Upload Section */}
          <div className="mx-4 mb-4">
            {photoUrl ? (
              <div className="relative w-full bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                <Image src={photoUrl} alt="跑步照片" width={500} height={200} className="w-full h-48 object-cover" unoptimized />
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

          {/* AI Storytelling Section (NEW) */}
          <div className="mx-4 mb-8">
            {!story ? (
              <button
                onClick={handleGenerateStory}
                disabled={isGeneratingStory}
                className="w-full relative group overflow-hidden bg-slate-900 rounded-2xl p-6 border border-primary/20 hover:border-primary/40 transition-all active:scale-[0.98] disabled:opacity-70"
              >
                {isGeneratingStory ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <span className="text-sm font-bold text-primary/80 animate-pulse">AI 正在吟唱史诗...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-white font-bold text-lg flex items-center gap-2">
                        🔥 生成史诗战报
                        <span className="bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded border border-primary/20">AI</span>
                      </span>
                      <span className="text-white/40 text-xs">让 Qwen 为您的征程谱写华章</span>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:bg-primary/20 transition-colors">
                      <ChevronRight className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                )}
                {/* Neon glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 opacity-50 pointer-events-none" />
              </button>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900 rounded-2xl p-6 border border-primary/30 shadow-[0_0_20px_rgba(34,197,94,0.1)] relative overflow-hidden"
              >
                <div className="flex items-center gap-2 text-primary mb-4">
                  <span className="h-1 w-4 bg-primary rounded-full" />
                  <span className="text-xs font-black uppercase tracking-widest">战况记录</span>
                </div>
                
                <p className="text-white/90 text-sm leading-relaxed mb-6 font-medium font-serif italic">
                  “{story}”
                </p>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={handleCopyStory}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-full text-xs font-bold border border-white/10 transition-colors"
                  >
                    <span>设为分享文案</span>
                  </button>
                  <button
                    onClick={handleGenerateStory}
                    className="text-primary/60 text-[10px] hover:text-primary transition-colors underline underline-offset-4"
                  >
                    重新生成
                  </button>
                </div>

                {/* Cyberpunk decoration */}
                <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/5 blur-3xl pointer-events-none" />
              </motion.div>
            )}
          </div>
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
              onClick={handleShareToFeed}
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
        <AnimatePresence initial={false}>
          {showAntiCheatModal && (
            <motion.div
              className="fixed inset-0 z-[10010] flex items-center justify-center bg-black/70 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-2xl"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1, x: [-6, 6, -5, 5, -4, 4, 0] }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <h3 className="text-lg font-bold text-red-600">风控拦截</h3>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  检测到异常的运动数据（步幅或步频与真实跑步不符）。本次运动不计入成绩，未获得任何领地和收益。请勿使用载具或虚拟定位设备。
                </p>
                {antiCheatLog && (
                  <p className="mt-2 text-xs text-slate-500">风控原因: {antiCheatLog}</p>
                )}
                <button
                  onClick={() => setShowAntiCheatModal(false)}
                  className="mt-5 h-11 w-full rounded-xl bg-red-600 font-semibold text-white hover:bg-red-500"
                >
                  我知道了
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Portal>
  )
}
