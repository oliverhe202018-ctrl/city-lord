"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useGameStore, useGameActions } from "@/store/useGameStore";
import { useRegion } from "@/contexts/RegionContext";
import { Trophy, AlertCircle, MapPin, Loader2, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ProvinceRankItem } from "./ProvinceRankItem";
import { DistrictEmptyState } from "./DistrictEmptyState";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useMapInteractionStore } from "@/store/useMapInteractionStore";
import { getUserTopTerritories } from "@/app/actions/club-service";

type LeaderboardTab = "district" | "province" | "global";

interface LeaderboardApiResponse {
  leaderboard: Array<{
    rank: number;
    name: string;
    score: number;
    scoreLabel?: string;
    avatar?: string;
    isMe: boolean;
    userId?: string;
  }>;
  myRank: {
    rank: number;
    name: string;
    score: number;
    scoreLabel?: string;
    isMe: boolean;
    gapToTarget?: number;
    userId?: string;
  } | null;
  isProvinceRanking?: boolean;
  fallback?: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2 px-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/5 p-3 animate-pulse"
        >
          <div className="h-6 w-6 rounded-full bg-white/10" />
          <div className="h-10 w-10 rounded-full bg-white/10 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-24 rounded bg-white/10" />
            <div className="h-3 w-16 rounded bg-white/10" />
          </div>
          <div className="h-6 w-16 rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}

export function LeaderboardDrawer() {
  const activeDrawer = useGameStore((state) => state.activeDrawer);
  const { closeDrawer } = useGameActions();
  const { user } = useAuth();
  const { region } = useRegion();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<LeaderboardTab>("district");
  const [selectedPlayer, setSelectedPlayer] = useState<{ userId: string; name: string } | null>(null);
  const [playerTerritories, setPlayerTerritories] = useState<any[]>([]);
  const [isLoadingTerritories, setIsLoadingTerritories] = useState(false);

  const setPendingCameraFocus = useMapInteractionStore((s) => s.setPendingCameraFocus);

  const isOpen = activeDrawer === "leaderboard";

  // 重置子页面状态当抽屉关闭
  useEffect(() => {
    if (!isOpen) {
      setSelectedPlayer(null);
      setPlayerTerritories([]);
    }
  }, [isOpen]);

  const handlePlayerClick = useCallback(async (item: { userId?: string; name: string }) => {
    if (!item.userId) return;
    setSelectedPlayer({ userId: item.userId, name: item.name });
    setIsLoadingTerritories(true);
    try {
      const territories = await getUserTopTerritories(item.userId);
      setPlayerTerritories(territories);
    } catch (e) {
      console.error("Failed to load user top territories:", e);
    } finally {
      setIsLoadingTerritories(false);
    }
  }, []);

  const handleTerritoryClick = useCallback((territory: any) => {
    // 1. 触发高德平滑飞行，传递边界多边形以进行 FitView 智能缩放
    setPendingCameraFocus({
      lng: territory.center[0],
      lat: territory.center[1],
      zoom: 17,
      territoryId: territory.id,
      polygonPoints: territory.polygonPoints,
    });
    // 2. 关闭抽屉
    closeDrawer();
    // 3. 触发切换到 play 视图
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("citylord:switch-tab", { detail: { tab: "play" } }));
    }
  }, [closeDrawer, setPendingCameraFocus]);

  const renderPlayerTerritoriesSubPage = () => {
    if (!selectedPlayer) return null;

    return (
      <div className="absolute inset-0 bg-background/98 backdrop-blur-xl z-20 flex flex-col pt-12 pb-32">
        <div className="shrink-0 flex items-center gap-2 border-b border-white/5 px-6 py-3">
          <button
            onClick={() => {
              setSelectedPlayer(null);
              setPlayerTerritories([]);
            }}
            className="p-2 -ml-2 rounded-full hover:bg-white/5 active:scale-95 transition-all text-white/80"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 ml-2">
            <h2 className="text-base font-bold text-white truncate">
              {selectedPlayer.name} 的顶尖领地
            </h2>
            <p className="text-white/40 text-xs truncate">
              展示面积排名前 5 的活跃领地
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-4 space-y-3" style={{ WebkitOverflowScrolling: "touch" }}>
          {isLoadingTerritories ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              <span className="text-sm text-white/40 animate-pulse">正在获取领主领地...</span>
            </div>
          ) : playerTerritories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/40 gap-2">
              <AlertCircle className="h-10 w-10 opacity-50" />
              <span className="text-sm">该领主目前没有占领的领地</span>
            </div>
          ) : (
            <div className="space-y-3">
              {playerTerritories.map((t, idx) => (
                <div
                  key={t.id}
                  onClick={() => handleTerritoryClick(t)}
                  className="group relative flex flex-col gap-2 rounded-2xl border border-white/5 bg-white/5 p-4 transition-all hover:bg-white/10 active:scale-[0.98] cursor-pointer hover:border-amber-500/30 overflow-hidden"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-xs font-bold text-amber-500">
                        {idx + 1}
                      </div>
                      <span className="font-bold text-white text-sm group-hover:text-amber-400 transition-colors">
                        {t.customName || t.name}
                      </span>
                    </div>
                    <span className="text-xs text-white/60 font-medium">
                      {t.area.toLocaleString()} m²
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs mt-1">
                    <div className="flex items-center gap-1 text-white/40">
                      <MapPin className="w-3 h-3 text-amber-500/70" />
                      <span>查看地图位置</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-white/40">生命值:</span>
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-16 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full",
                              t.health > 50 ? "bg-emerald-500" : "bg-rose-500"
                            )} 
                            style={{ width: `${t.health}%` }}
                          />
                        </div>
                        <span className={cn(
                          "font-bold",
                          t.health > 50 ? "text-emerald-400" : "text-rose-400"
                        )}>
                          {t.health}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const { data, isLoading, isValidating } = useSWR<LeaderboardApiResponse>(
    isOpen ? `/api/leaderboard?type=${activeTab}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300_000,
    }
  );

  useEffect(() => {
    if (!isOpen) return;
    const districtCode = (window as any).__cachedDistrictCode;
    if (!districtCode && activeTab === "district") {
      setActiveTab("global");
    }
  }, [isOpen, activeTab]);

  const leaderboard = data?.leaderboard ?? [];
  const myRank = data?.myRank ?? null;
  const isProvinceRanking = data?.isProvinceRanking ?? false;
  const fallback = data?.fallback;

  const items = useMemo(() => leaderboard, [leaderboard]);

  const listParentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => listParentRef.current,
    estimateSize: () => 64,
    overscan: 5,
  });

  const handleGoToMap = useCallback(() => {
    closeDrawer();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("citylord:switch-tab", { detail: { tab: "play" } }));
    }
  }, [closeDrawer]);

  const districtLabel = useMemo(() => {
    if (region?.countyName) return region.countyName;
    if (region?.cityName) return region.cityName;
    return "同城";
  }, [region?.countyName, region?.cityName]);

  const tabLabels: Record<LeaderboardTab, string> = {
    district: districtLabel,
    province: "省份",
    global: "全国",
  };

  const renderContent = () => {
    if (isLoading || isValidating) {
      return <SkeletonRows />;
    }

    if (fallback === "no_district" && activeTab === "district") {
      return <DistrictEmptyState onGoToMap={handleGoToMap} />;
    }

    if (items.length === 0 && !myRank) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-white/40 gap-2">
          <AlertCircle className="h-10 w-10 opacity-50" />
          <span className="text-sm">暂无排名数据</span>
        </div>
      );
    }

    if (isProvinceRanking) {
      return (
        <div className="space-y-2 px-4">
          {items.map((item) => (
            <ProvinceRankItem
              key={`province-${item.rank}`}
              rank={item.rank}
              name={item.name}
              score={item.score}
            />
          ))}
        </div>
      );
    }

    return (
      <>
        <div
          ref={listParentRef}
          className="max-h-[60vh] overflow-y-auto overscroll-contain transform-gpu scrollbar-hide"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const item = items[virtualRow.index];
              if (!item) return null;
              return (
                <div
                  key={`lb-${item.rank}-${virtualRow.key}`}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <PlayerRankItem
                    rank={item.rank}
                    name={item.name}
                    score={item.score}
                    scoreLabel={item.scoreLabel}
                    avatar={item.avatar}
                    isMe={item.isMe}
                    onClick={() => handlePlayerClick(item)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {myRank && !items.some((r) => r.isMe) && (
          <div className="px-4 mt-3">
            <PlayerRankItem
              rank={myRank.rank}
              name={myRank.name}
              score={myRank.score}
              scoreLabel={myRank.scoreLabel}
              isMe
              onClick={() => handlePlayerClick(myRank)}
            />
          </div>
        )}
      </>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeDrawer()}>
      <SheetContent
        side="bottom"
        className="w-full sm:max-w-md p-0 flex flex-col bg-background/95 backdrop-blur-xl border-none h-[100dvh] rounded-none z-[51]"
      >
        <SheetHeader className="px-6 pt-12 pb-2 shrink-0">
          <SheetTitle className="text-center flex items-center justify-center gap-2 text-xl font-bold bg-gradient-to-r from-yellow-500 to-amber-600 bg-clip-text text-transparent">
            <Trophy className="w-6 h-6 text-amber-500" />
            风云榜
          </SheetTitle>
          <SheetDescription className="text-center text-xs">
            每日 0 点刷新的领地占领排名
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pb-3 shrink-0 space-y-3">
            <div className="grid w-full grid-cols-3 h-10 p-1 bg-muted/50 rounded-xl">
              {(["district", "province", "global"] as LeaderboardTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "rounded-lg text-xs font-medium transition-all",
                    activeTab === tab
                      ? "bg-primary/20 text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tabLabels[tab]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain transform-gpu px-0 pb-32 scrollbar-hide" style={{ WebkitOverflowScrolling: "touch" }}>
            <div className="mt-2 pb-4">
              {renderContent()}
            </div>
          </div>
        </div>
        
        {/* Render the stunning player territories sub-page overlay when clicked */}
        {renderPlayerTerritoriesSubPage()}
      </SheetContent>
    </Sheet>
  );
}

function PlayerRankItem({
  rank,
  name,
  score,
  scoreLabel,
  avatar,
  isMe,
  onClick,
}: {
  rank: number;
  name: string;
  score: number;
  scoreLabel?: string;
  avatar?: string;
  isMe: boolean;
  onClick?: () => void;
}) {
  const rankIcon =
    rank === 1 ? (
      <span className="text-lg">🥇</span>
    ) : rank === 2 ? (
      <span className="text-lg">🥈</span>
    ) : rank === 3 ? (
      <span className="text-lg">🥉</span>
    ) : (
      <span className="text-sm font-bold text-white/40 w-6 text-center">#{rank}</span>
    );

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3 transition-all cursor-pointer",
        isMe
          ? "bg-[#39ff14]/5 border-[#39ff14]/30"
          : "bg-white/5 border-white/5 hover:bg-white/10 active:scale-[0.98]"
      )}
    >
      <div className="flex w-8 items-center justify-center">{rankIcon}</div>

      {avatar ? (
        <div className="h-10 w-10 rounded-full bg-white/10 overflow-hidden shrink-0 border border-white/10">
          <img
            src={avatar}
            alt={name}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
              const parent = (e.target as HTMLImageElement).parentElement;
              if (parent) {
                const fb = parent.querySelector("[data-fb]") as HTMLElement;
                if (fb) fb.style.display = "flex";
              }
            }}
          />
          <div
            data-fb
            className="h-full w-full bg-white/10 items-center justify-center hidden text-xs font-bold text-white/40"
          >
            {name.charAt(0)}
          </div>
        </div>
      ) : (
        <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/40 shrink-0">
          {name.charAt(0)}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "font-bold truncate text-sm",
              isMe ? "text-[#39ff14]" : "text-white"
            )}
          >
            {name}
          </span>
          {isMe && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#39ff14]/20 text-[#39ff14]">
              我
            </span>
          )}
        </div>
      </div>

      <div className="text-right">
        <div className="font-bold text-lg text-white leading-none">
          {scoreLabel ?? `${score.toLocaleString()} m²`}
        </div>
      </div>
    </div>
  );
}
