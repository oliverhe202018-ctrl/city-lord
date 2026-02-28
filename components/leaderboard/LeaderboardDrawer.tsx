
"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useGameStore, useGameActions } from "@/store/useGameStore";
import { RankItem } from "./RankItem";
import { RankData } from "./mock-data";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trophy, AlertCircle, Map, Globe, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLeaderboardData, LeaderboardEntry } from "@/app/actions/leaderboard";
import { useAuth } from "@/hooks/useAuth";

export function LeaderboardDrawer() {
  const activeDrawer = useGameStore((state) => state.activeDrawer);
  const myClub = useGameStore((state) => state.myClub);
  const { closeDrawer } = useGameActions();
  const { user } = useAuth();

  // Tabs: 'personal' | 'club' | 'province'
  const [activeTab, setActiveTab] = useState("personal");
  // Club Sub-tabs: 'local' | 'national'
  const [clubSubTab, setClubSubTab] = useState<"local" | "national">("local");
  // Personal Sub-tabs: 'national' | 'province'
  const [personalSubTab, setPersonalSubTab] = useState<"national" | "province">("national");
  // Province Sub-tabs: 'national' | 'local'
  const [provinceSubTab, setProvinceSubTab] = useState<"national" | "local">("national");

  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 20;

  const isOpen = activeDrawer === "leaderboard";

  // Reset pagination when tabs change
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    setLeaderboardData([]);
  }, [activeTab, clubSubTab, personalSubTab, provinceSubTab]);

  useEffect(() => {
    if (isOpen) {
      if (page === 1) {
        fetchData(1);
      } else {
        // If it's already rendered and user paginated, keep data
      }
    }
  }, [isOpen, activeTab, clubSubTab, personalSubTab, provinceSubTab]);

  const fetchData = async (pageNum: number) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      let type: 'PERSONAL' | 'PERSONAL_PROVINCE' | 'CLUB_NATIONAL' | 'CLUB_PROVINCE' | 'PROVINCE' | 'PROVINCE_CITY' = 'PERSONAL';

      if (activeTab === 'personal') {
        type = personalSubTab === 'province' ? 'PERSONAL_PROVINCE' : 'PERSONAL';
      } else if (activeTab === 'club') {
        type = clubSubTab === 'local' ? 'CLUB_PROVINCE' : 'CLUB_NATIONAL';
      } else if (activeTab === 'province') {
        type = provinceSubTab === 'local' ? 'PROVINCE_CITY' : 'PROVINCE';
      }

      const newData = await getLeaderboardData(type, user?.id, pageNum, ITEMS_PER_PAGE);

      if (newData.length < ITEMS_PER_PAGE) {
        setHasMore(false);
      }

      if (pageNum === 1) {
        setLeaderboardData(newData);
      } else {
        setLeaderboardData(prev => [...prev, ...newData]);
      }
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
    } finally {
      if (pageNum === 1) setLoading(false);
      else setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchData(nextPage);
    }
  };

  const getMyRank = (): LeaderboardEntry | undefined => {
    return leaderboardData.find(item => item.is_me);
  };

  const renderList = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
          加载中...
        </div>
      );
    }

    if (leaderboardData.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2">
          <AlertCircle className="w-8 h-8 opacity-50" />
          <span>暂无数据</span>
        </div>
      );
    }

    return (
      <div className="space-y-2 p-1">
        {leaderboardData.map((item) => (
          <RankItem
            key={item.id}
            data={{
              rank: item.rank,
              name: item.name,
              avatar: item.avatar_url,
              score: item.score,
              change: item.change || 'same',
              aux: item.secondary_info,
              isMe: item.is_me
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeDrawer()}>
      <SheetContent
        side="bottom"
        className="w-full sm:max-w-md p-0 flex flex-col bg-background/95 backdrop-blur-xl border-none h-[100dvh] rounded-none z-[40]" // z-[40] to keep bottom nav (z-50) accessible
      >
        <SheetHeader className="px-6 pt-12 pb-2 shrink-0">
          <SheetTitle className="text-center flex items-center justify-center gap-2 text-xl font-bold bg-gradient-to-r from-yellow-500 to-amber-600 bg-clip-text text-transparent">
            <Trophy className="w-6 h-6 text-amber-500" />
            风云榜
          </SheetTitle>
          <SheetDescription className="text-center text-xs">
            实时更新的领地争夺战况
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="personal" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pb-2 shrink-0 space-y-3">
            {/* Level 1 Navigation */}
            <TabsList className="grid w-full grid-cols-3 h-10 p-1 bg-muted/50 rounded-xl">
              <TabsTrigger value="personal" className="rounded-lg text-xs">个人</TabsTrigger>
              <TabsTrigger value="club" className="rounded-lg text-xs">俱乐部</TabsTrigger>
              <TabsTrigger value="province" className="rounded-lg text-xs">省份</TabsTrigger>
            </TabsList>

            {/* Level 2 Navigation (Personal & Club) */}
            {activeTab === 'personal' && (
              <div className="flex justify-center animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="bg-muted/30 p-1 rounded-lg flex gap-1">
                  <button
                    onClick={() => setPersonalSubTab("national")}
                    className={cn(
                      "px-4 py-1.5 text-xs font-medium rounded-md transition-all",
                      personalSubTab === "national"
                        ? "bg-primary/20 text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    全国
                  </button>
                  <button
                    onClick={() => setPersonalSubTab("province")}
                    className={cn(
                      "px-4 py-1.5 text-xs font-medium rounded-md transition-all",
                      personalSubTab === "province"
                        ? "bg-primary/20 text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    省内
                  </button>
                </div>
              </div>
            )}
            {activeTab === 'club' && (
              <div className="flex justify-center animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="bg-muted/30 p-1 rounded-lg flex gap-1">
                  <button
                    onClick={() => setClubSubTab("local")}
                    className={cn(
                      "px-4 py-1.5 text-xs font-medium rounded-md transition-all",
                      clubSubTab === "local"
                        ? "bg-primary/20 text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    省内
                  </button>
                  <button
                    onClick={() => setClubSubTab("national")}
                    className={cn(
                      "px-4 py-1.5 text-xs font-medium rounded-md transition-all",
                      clubSubTab === "national"
                        ? "bg-primary/20 text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    全国
                  </button>
                </div>
              </div>
            )}
            {activeTab === 'province' && (
              <div className="flex justify-center animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="bg-muted/30 p-1 rounded-lg flex gap-1">
                  <button
                    onClick={() => setProvinceSubTab("national")}
                    className={cn(
                      "px-4 py-1.5 text-xs font-medium rounded-md transition-all",
                      provinceSubTab === "national"
                        ? "bg-primary/20 text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    全国
                  </button>
                  <button
                    onClick={() => setProvinceSubTab("local")}
                    className={cn(
                      "px-4 py-1.5 text-xs font-medium rounded-md transition-all",
                      provinceSubTab === "local"
                        ? "bg-primary/20 text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    省内
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Scrollable content area with absolute height to guarantee scrolling */}
          <div className="flex-1 overflow-y-auto px-4 pb-32 overscroll-contain">
            <div className="mt-2 pb-4">
              {renderList()}

              {/* Pagination / Load More Button */}
              {!loading && leaderboardData.length > 0 && hasMore && (
                <div className="flex justify-center py-4">
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors bg-muted/20 px-4 py-2 rounded-full flex items-center gap-2"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <>
                        <span className="w-3 h-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin"></span>
                        加载中...
                      </>
                    ) : '加载更多'}
                  </button>
                </div>
              )}
              {!loading && leaderboardData.length > 0 && !hasMore && (
                <div className="text-center py-4 text-xs text-muted-foreground opacity-50">
                  已经到底了
                </div>
              )}
            </div>
          </div>

          {/* Sticky Bottom for My Rank - Adjusted bottom padding for bottom-nav */}
          {!loading && leaderboardData.length > 0 && (
            <StickyBottom
              data={getMyRank()}
              label={
                activeTab === 'personal' ? '我的排名' :
                  activeTab === 'club' ? '我的俱乐部' :
                    '我的省份'
              }
            />
          )}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function StickyBottom({ data, label }: { data?: LeaderboardEntry; label: string }) {
  if (!data) return null;

  // Map LeaderboardEntry to RankData for RankItem
  const rankData: RankData = {
    rank: data.rank,
    name: data.name,
    avatar: data.avatar_url,
    score: data.score,
    change: data.change || 'same',
    aux: data.secondary_info,
    isMe: false // Set false to avoid double highlight in the sticky bar
  };

  return (
    <div className="absolute bottom-[80px] left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent pt-10">
      <div className="bg-primary/10 border border-primary/20 backdrop-blur-md rounded-xl p-3 shadow-lg flex items-center">
        <div className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded mr-3 whitespace-nowrap">
          {label}
        </div>
        <div className="flex-1 min-w-0">
          <RankItem data={rankData} />
        </div>
      </div>
    </div>
  );
}
