'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useGameStore } from '@/store/useGameStore';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { MapPin, Users, Crown, Settings, LogOut, ChevronLeft, Trophy, TrendingUp, ExternalLink, Clock, User } from 'lucide-react';
import { ClubManageDrawer } from './ClubManageDrawer';
import { AvatarUploader } from '@/components/ui/AvatarUploader';
import { useRouter } from 'next/navigation';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import { getClubLeaderboard, getClubTerritories, getClubRankings, getInternalMembers, getClubTerritoriesReal, getClubHistory } from '@/app/actions/club';

interface Club {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  owner_id: string;
  member_count: number;
  level: number;
  territory: string;
  province?: string;
  total_area?: number;
}

interface ClubTerritory {
  id: string;
  name: string;
  area: number;
  date: string;
  member: string;
  memberName: string;
  lastTime: string;
  pace?: string;
  location?: string;
  totalDistance?: string;
  totalTime?: string;
  avgPace?: string;
}

interface LeaderboardItem {
  id: string;
  name: string;
  avatar: string;
  area?: number;
  score?: number;
  rank?: number;
  province?: string;
}

import { useRegion } from '@/contexts/RegionContext';

// ... existing code ...

export function ClubDetailView({ clubId, onChange }: { clubId: string; onChange?: () => void }) {
  const { region } = useRegion();
  const [club, setClub] = useState<Club | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [territories, setTerritories] = useState<ClubTerritory[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [myRanking, setMyRanking] = useState<LeaderboardItem | null>(null);
  const [historyData, setHistoryData] = useState<{date: string, area: number}[]>([]);
  
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'territories' | 'history'>('leaderboard');
  // 'internal' = Club Ranking (Members), 'ranking' = Global/Province Ranking
  const [rankingType, setRankingType] = useState<'ranking' | 'internal'>('ranking');
  const [rankingScope, setRankingScope] = useState<'province' | 'national'>('national');
  
  const [territorySortBy, setTerritorySortBy] = useState<'date' | 'area'>('date');
  // Use province from RegionContext if available, otherwise default to '未知'
  const [userProvince, setUserProvince] = useState<string>(region?.province || '未知');
  
  const userId = useGameStore((state) => state.userId);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (clubId) fetchClubDetails();
    
    // If we have region data from context, use it directly
    if (region?.province) {
        setUserProvince(region.province);
        setRankingScope('province');
    } else {
        // Fallback to fetching from profile if context is not ready
        fetchUserProfile();
    }
  }, [clubId, region?.province]);

  // Fetch data when tabs change
  useEffect(() => {
    if (!clubId) return;

    if (activeTab === 'leaderboard') {
        fetchLeaderboard();
    } else if (activeTab === 'territories') {
        fetchTerritories();
    } else if (activeTab === 'history') {
        fetchHistory();
    }
  }, [activeTab, rankingType, rankingScope, territorySortBy, clubId, userProvince]);

  async function fetchUserProfile() {
      // Avoid fetching if we already have it from context
      if (region?.province) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
          const { data: profile } = await supabase.from('profiles').select('province').eq('id', user.id).single();
          if (profile && profile.province) {
              setUserProvince(profile.province);
              // Default to province ranking if user has province
              setRankingScope('province'); 
          }
      }
  }

  async function fetchClubDetails() {
    const { data } = await supabase.from('clubs').select('*').eq('id', clubId).single();
    if (data) {
      setClub(data as Club);
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id === data.owner_id) setIsOwner(true);
    }
  }

  async function fetchLeaderboard() {
      setLeaderboard([]);
      setMyRanking(null);

      if (rankingType === 'internal') {
          // Internal Club Ranking (Members)
          const members = await getInternalMembers(clubId);
          setLeaderboard(members as any);
      } else {
          // Global/Province Ranking (Clubs)
          const { data, myClub } = await getClubRankings(rankingScope, userProvince);
          setLeaderboard(data);
          // Only show pinned row if rank > 1 (User requirement: "If I am #1, no need extra pin")
          if (myClub && myClub.rank && myClub.rank > 1) {
              setMyRanking(myClub);
          }
      }
  }

  async function fetchTerritories() {
      const data = await getClubTerritoriesReal(clubId, territorySortBy);
      setTerritories(data);
  }

  async function fetchHistory() {
      const data = await getClubHistory(clubId);
      setHistoryData(data);
  }


  const handleQuit = async () => {
    // Implement quit logic
    toast.success('已退出俱乐部');
    router.push('/club?view=list');
  }

  if (!club) return <div className="p-8 text-center text-white">加载中...</div>;

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-white pb-20 overflow-x-hidden">
      {/* 顶部 Header - 参考图 1 */}
      <div className="pt-8 pb-6 px-6 bg-zinc-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-zinc-800">
               <img src={club.avatar_url || '/placeholder.png'} className="w-full h-full object-cover" alt="Club Avatar" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{club.name}</h1>
              <button 
                onClick={onChange}
                className="text-sm text-zinc-500 hover:text-white transition-colors"
              >
                更换
              </button>
            </div>
          </div>
          <div className="flex gap-8 text-center">
            <div>
              <div className="text-xs text-zinc-500 uppercase font-semibold mb-1">当前领地</div>
              <div className="text-xl font-bold text-white">{club.territory || '0'} <span className="text-sm font-normal text-zinc-500">KM²</span></div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 uppercase font-semibold mb-1">总成员</div>
              <div className="text-xl font-bold text-white">{club.member_count}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation - 参考图 2 */}
      <div className="px-4 border-b border-zinc-800 flex gap-8 mb-4">
         <button
            onClick={() => setActiveTab('leaderboard')}
            className={`pb-3 text-sm font-bold uppercase tracking-wide transition-colors relative ${
              activeTab === 'leaderboard' ? 'text-white' : 'text-zinc-500'
            }`}
          >
            排行榜
            {activeTab === 'leaderboard' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-t-full" />}
          </button>
          <button
            onClick={() => setActiveTab('territories')}
            className={`pb-3 text-sm font-bold uppercase tracking-wide transition-colors relative ${
              activeTab === 'territories' ? 'text-white' : 'text-zinc-500'
            }`}
          >
            领地
            {activeTab === 'territories' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-t-full" />}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 text-sm font-bold uppercase tracking-wide transition-colors relative ${
              activeTab === 'history' ? 'text-white' : 'text-zinc-500'
            }`}
          >
            历史
            {activeTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-t-full" />}
          </button>
      </div>

      {/* Tab Content */}
      <div className="px-4 flex-1">
        {activeTab === 'leaderboard' && (
          <div className="space-y-4">
             {/* Sub Tabs */}
             <div className="flex bg-zinc-900 rounded-full p-1 mb-4">
                <button 
                  onClick={() => setRankingType('ranking')}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-full transition-all ${rankingType === 'ranking' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  排行榜
                </button>
                <button 
                  onClick={() => setRankingType('internal')}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-full transition-all ${rankingType === 'internal' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  俱乐部排行
                </button>
             </div>

             {/* Filter Pills (Only for Ranking) */}
             {rankingType === 'ranking' && (
               <div className="flex bg-zinc-900 rounded-full p-1 mb-4">
                  <button 
                    onClick={() => setRankingScope('province')}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-full transition-all ${rankingScope === 'province' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'} flex items-center justify-center gap-2`}
                  >
                     {userProvince} <span className="text-xs">🇨🇳</span>
                  </button>
                  <button 
                    onClick={() => setRankingScope('national')}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-full transition-all ${rankingScope === 'national' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                     全国
                  </button>
               </div>
             )}

             {/* Leaderboard List */}
             <div className="space-y-2">
                {/* My Rank Row (Sticky) */}
                {myRanking && (
                    <div className="bg-zinc-800/80 rounded-lg p-3 flex items-center mb-4 border border-zinc-700/50 sticky top-0 z-10 backdrop-blur-sm">
                        <div className="w-8 text-center font-bold text-white text-lg">{myRanking.rank}</div>
                        <div className="w-10 h-10 rounded-full overflow-hidden mx-3 bg-zinc-700">
                          <img src={myRanking.avatar || '/placeholder.png'} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 font-semibold text-white">{myRanking.name}</div>
                        <div className="font-bold text-white">{myRanking.score || 0} <span className="text-xs font-normal text-zinc-500">KM²</span></div>
                    </div>
                )}

                {/* List */}
                {leaderboard.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500">暂无数据</div>
                ) : (
                    leaderboard.map((item, i) => {
                      const rank = item.rank || (i + 1);
                      let bgClass = "bg-zinc-900";
                      let rankColor = "text-white";
                      let score = item.score || item.area || 0;

                      // Special styling for top 3
                      if (rank === 1) {
                        bgClass = "bg-gradient-to-r from-yellow-900/40 to-zinc-900 border-l-4 border-yellow-500";
                        rankColor = "text-yellow-500";
                      } else if (rank === 2) {
                         bgClass = "bg-gradient-to-r from-slate-700/40 to-zinc-900 border-l-4 border-slate-400";
                         rankColor = "text-slate-400";
                      } else if (rank === 3) {
                         bgClass = "bg-gradient-to-r from-orange-900/40 to-zinc-900 border-l-4 border-orange-700";
                         rankColor = "text-orange-700";
                      }

                      return (
                        <div key={item.id} className={`${bgClass} rounded-lg p-3 flex items-center transition-transform active:scale-[0.99]`}>
                            <div className={`w-8 text-center font-bold text-lg ${rankColor} italic`}>{rank}</div>
                            <div className="w-8 h-8 rounded-full overflow-hidden mx-3 bg-zinc-800 border border-white/10">
                               <img src={item.avatar || '/placeholder.png'} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 font-semibold text-white ml-2">{item.name}</div>
                            <div className="font-bold text-white">{score} <span className="text-xs font-normal text-zinc-500">KM²</span></div>
                        </div>
                      )
                    })
                )}
             </div>
          </div>
        )}

        {activeTab === 'territories' && (
           <div className="space-y-4">
              {/* Sort Buttons */}
              <div className="flex gap-2">
                 <button 
                    onClick={() => setTerritorySortBy('date')}
                    className={`flex-1 py-2 rounded-full text-sm font-medium border border-zinc-800 transition-colors ${territorySortBy === 'date' ? 'bg-zinc-800 text-white' : 'bg-zinc-900 text-zinc-500 hover:text-white'}`}
                 >
                    按日期排序
                 </button>
                 <button 
                    onClick={() => setTerritorySortBy('area')}
                    className={`flex-1 py-2 rounded-full text-sm font-medium border border-zinc-800 transition-colors ${territorySortBy === 'area' ? 'bg-zinc-800 text-white' : 'bg-zinc-900 text-zinc-500 hover:text-white'}`}
                 >
                    按面积排序
                 </button>
              </div>

              {/* Territory List */}
              <div className="space-y-3">
                 {territories.length === 0 ? (
                     <div className="text-center py-8 text-zinc-500">暂无记录</div>
                 ) : (
                     territories.map((t) => (
                        <div key={t.id} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800/50">
                           <div className="flex items-start gap-3 mb-4">
                              <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden">
                                 <img src={t.member || '/placeholder-user.jpg'} className="w-full h-full object-cover" />
                              </div>
                              <div>
                                 <div className="text-sm text-zinc-400">{t.date} {t.lastTime}</div>
                                 <div className="text-sm text-white font-medium">{t.memberName} 在 {t.location} 占领了领地</div>
                              </div>
                           </div>

                           <div className="grid grid-cols-4 gap-4 text-center">
                              <div>
                                 <div className="text-xl font-bold text-white">{t.totalDistance}</div>
                                 <div className="text-xs text-zinc-500">里程</div>
                              </div>
                              <div>
                                 <div className="text-xl font-bold text-white">{t.totalTime}</div>
                                 <div className="text-xs text-zinc-500">时长</div>
                              </div>
                              <div>
                                 <div className="text-xl font-bold text-white">{t.avgPace}</div>
                                 <div className="text-xs text-zinc-500">配速</div>
                              </div>
                              <div>
                                 <div className="text-xl font-bold text-white">{t.area}</div>
                                 <div className="text-xs text-zinc-500">面积 (km²)</div>
                              </div>
                           </div>
                        </div>
                     ))
                 )}
              </div>
           </div>
        )}

        {activeTab === 'history' && (
          <div className="h-[400px] w-full bg-zinc-900 rounded-xl p-4">
             <h3 className="text-white font-bold mb-6">领地历史趋势 (30天)</h3>
             {historyData.length === 0 ? (
                 <div className="flex items-center justify-center h-[300px] text-zinc-500">暂无历史数据</div>
             ) : (
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={historyData}>
                      <defs>
                        <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8884d8" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        stroke="#666" 
                        tick={{fill: '#666', fontSize: 12}}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={30}
                      />
                      <YAxis 
                        stroke="#666"
                        tick={{fill: '#666', fontSize: 12}} 
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}`}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                        formatter={(value: any) => [`${value} km²`, '面积']}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="area" 
                        stroke="#8884d8" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorArea)" 
                        strokeLinecap="round"
                      />
                    </AreaChart>
                 </ResponsiveContainer>
             )}
          </div>
        )}
      </div>
    </div>
  );
}
