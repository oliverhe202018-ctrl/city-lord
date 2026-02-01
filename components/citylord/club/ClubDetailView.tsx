'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useGameStore } from '@/store/useGameStore';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { MapPin, Users, Crown, Settings, LogOut, ChevronLeft, Trophy, TrendingUp, ExternalLink, Clock } from 'lucide-react';
import { ClubManageDrawer } from './ClubManageDrawer';
import { AvatarUploader } from '@/components/ui/AvatarUploader';
import { useRouter } from 'next/navigation';

import { getClubLeaderboard, getClubTerritories } from '@/app/actions/club';

interface Club {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  owner_id: string;
  member_count: number;
  level: number;
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
  area: number;
  score?: number;
}

export function ClubDetailView({ clubId }: { clubId: string }) {
  const [club, setClub] = useState<Club | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'leaderboard' | 'territories' | 'history'>('info');
  const [leaderboardSubTab, setLeaderboardSubTab] = useState<'club' | 'province' | 'national'>('club');
  const [territorySortBy, setTerritorySortBy] = useState<'date' | 'area'>('date');
  const userId = useGameStore((state) => state.userId);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (clubId) fetchClubDetails();
  }, [clubId]);

  async function fetchClubDetails() {
    const { data } = await supabase.from('clubs').select('*').eq('id', clubId).single();
    if (data) {
      setClub(data as Club);
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id === data.owner_id) setIsOwner(true);
    }
  }

  async function handleQuit() {
    if (!confirm('确定要退出俱乐部吗？')) return;
    const { error } = await supabase.from('club_members').delete().match({
      club_id: clubId,
      user_id: userId
    });
    
    if (!error) {
      await supabase.from('profiles').update({ club_id: null } as any).eq('id', userId);
      toast.success('已退出');
      window.location.reload();
    } else {
      toast.error('退出失败');
    }
  }

  if (!club) return <div className="p-8 text-center">加载中...</div>;

  const territoriesByDate: ClubTerritory[] = territories;

  // Simplified sort for demo
  const territoriesByArea: ClubTerritory[] = [...territories].sort((a, b) => b.area - a.area);

  const clubInternalLeaderboard: LeaderboardItem[] = leaderboard;

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20 overflow-x-hidden">
      {/* 顶部 Banner */}
      <div className="relative w-full h-48 bg-gradient-to-br from-indigo-600 to-purple-700">
        <div className="absolute -bottom-10 left-6">
          <div className="w-24 h-24 rounded-xl border-4 border-background bg-card shadow-lg overflow-hidden relative group">
            {isOwner ? (
              <AvatarUploader 
                currentAvatarUrl={club.avatar_url} 
                onUploadComplete={() => fetchClubDetails()} 
              />
            ) : (
              <img src={club.avatar_url || '/placeholder.png'} className="w-full h-full object-cover" alt="Club Avatar" />
            )}
          </div>
        </div>
      </div>

      <div className="mt-12 px-6 space-y-6">
        {/* 标题区 */}
        <div>
          <h1 className="text-2xl font-bold">{club.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{club.description || '暂无简介'}</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab('info')}
            className={`pb-2 px-3 font-medium transition-colors whitespace-nowrap ${
              activeTab === 'info' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'
            }`}
          >
            信息
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`pb-2 px-3 font-medium transition-colors whitespace-nowrap ${
              activeTab === 'leaderboard' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'
            }`}
          >
            排行榜
          </button>
          <button
            onClick={() => setActiveTab('territories')}
            className={`pb-2 px-3 font-medium transition-colors whitespace-nowrap ${
              activeTab === 'territories' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'
            }`}
          >
            领地
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2 px-3 font-medium transition-colors whitespace-nowrap ${
              activeTab === 'history' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'
            }`}
          >
            历史
          </button>
        </div>

        {/* 根据Tab显示不同内容 */}
        {activeTab === 'info' && (
          <div className="space-y-6">
            {/* 统计卡片 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-card border rounded-lg text-center shadow-sm">
                <Users className="w-5 h-5 mx-auto mb-2 text-blue-500" />
                <div className="font-bold">{club.member_count || 1}</div>
                <div className="text-xs text-muted-foreground">成员</div>
              </div>
              <div className="p-3 bg-card border rounded-lg text-center shadow-sm">
                <MapPin className="w-5 h-5 mx-auto mb-2 text-green-500" />
                <div className="font-bold">0</div>
                <div className="text-xs text-muted-foreground">领地</div>
              </div>
              <div className="p-3 bg-card border rounded-lg text-center shadow-sm">
                <Crown className="w-5 h-5 mx-auto mb-2 text-yellow-500" />
                <div className="font-bold">No.1</div>
                <div className="text-xs text-muted-foreground">排名</div>
              </div>
            </div>

            {/* 关于我们 */}
            <div className="bg-card border rounded-lg p-4">
              <h3 className="font-bold mb-2">关于我们</h3>
              <p className="text-sm text-muted-foreground">
                这是 {club.name} 的官方介绍。我们致力于推广健康跑，连接城市里的每一位跑者。加入我们，一起征服城市！
              </p>
            </div>

            {/* 核心功能按钮区 */}
            <div className="space-y-3 pt-4">
              {isOwner ? (
                <>
                  <Button className="w-full h-12 text-lg" onClick={() => setManageOpen(true)}>
                    <Settings className="mr-2 w-5 h-5" /> 管理俱乐部 (领主模式)
                  </Button>
                  <ClubManageDrawer 
                    isOpen={manageOpen} 
                    onClose={() => setManageOpen(false)} 
                    club={club} 
                  />
                </>
              ) : (
                <Button variant="destructive" className="w-full" onClick={handleQuit}>
                  <LogOut className="mr-2 w-4 h-4" /> 退出俱乐部
                </Button>
              )}
              
              <Button variant="ghost" className="w-full" onClick={() => router.push('/club?view=list')}>
                <ChevronLeft className="mr-2 w-4 h-4" /> 查看其他俱乐部
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div>
            <div className="flex gap-2 mb-4 border-b border-gray-200">
              <button
                onClick={() => setLeaderboardSubTab('club')}
                className={`pb-2 px-3 text-sm font-medium transition-colors ${
                  leaderboardSubTab === 'club' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'
                }`}
              >
                俱乐部内部
              </button>
              <button
                onClick={() => setLeaderboardSubTab('province')}
                className={`pb-2 px-3 text-sm font-medium transition-colors ${
                  leaderboardSubTab === 'province' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'
                }`}
              >
                省排行榜
              </button>
              <button
                onClick={() => setLeaderboardSubTab('national')}
                className={`pb-2 px-3 text-sm font-medium transition-colors ${
                  leaderboardSubTab === 'national' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'
                }`}
              >
                全国排行榜
              </button>
            </div>

            <div className="space-y-3">
              {clubInternalLeaderboard.map((item, index) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    index === 0 ? 'bg-yellow-500/20 border border-yellow-500' : 'bg-card hover:bg-muted'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${index === 0 ? 'bg-yellow-500 text-black' : 'bg-gray-300 text-white'}`}>
                    {index + 1}
                  </div>
                  <img src={item.avatar} alt={item.name} className="w-10 h-10 rounded-full" />
                  <div className="flex-1">
                    <div className="font-semibold">{item.name}</div>
                    <div className="text-sm text-muted-foreground">{item.area} mi²</div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'territories' && (
          <div>
            <div className="flex gap-2 mb-4 border-b border-gray-200">
              <button
                onClick={() => setTerritorySortBy('date')}
                className={`pb-2 px-3 text-sm font-medium transition-colors ${
                  territorySortBy === 'date' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'
                }`}
              >
                按时间排序
              </button>
              <button
                onClick={() => setTerritorySortBy('area')}
                className={`pb-2 px-3 text-sm font-medium transition-colors ${
                  territorySortBy === 'area' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'
                }`}
              >
                按面积排序
              </button>
            </div>

            <div className="space-y-3">
              {territorySortBy === 'date' && territoriesByDate.map((item) => (
                <div key={item.id} className="p-3 rounded-lg bg-card cursor-pointer hover:bg-muted transition-colors">
                  <div className="flex items-center gap-3">
                    <img src={item.member} alt={item.memberName} className="w-10 h-10 rounded-full" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.name}</span>
                        <span className="text-xs text-yellow-600">{item.date}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        <span>{item.area} mi²</span>
                        <span>•</span>
                        <Clock className="w-3 h-3" />
                        <span>{item.lastTime}</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        <span>配速: {item.pace}</span>
                        <span className="ml-2">领地面积: {item.area} mi²</span>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            <div className="bg-black/30 rounded-lg p-4">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                俱乐部领地随时间变化
              </h3>
              <div className="relative h-64 bg-gray-900/50 rounded-lg p-4">
                <div className="absolute bottom-0 left-0 right-0 h-48">
                  <svg className="w-full h-full" viewBox="0 0 400 192">
                    <path
                      d="M 20 180 L 60 160 L 100 140 L 140 120 L 180 100 L 220 80 L 260 60 L 300 40 L 340 20"
                      stroke="white"
                      strokeWidth="2"
                      fill="none"
                    />
                    <path
                      d="M 20 180 L 60 160 L 100 140 L 140 120 L 180 100 L 220 80 L 260 60 L 300 40 L 340 20 L 340 180 L 20 180"
                      stroke="none"
                      fill="rgba(255, 255, 255, 0.1)"
                    />
                  </svg>
                </div>
                <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-muted-foreground">
                  <span>579.1 mi²</span>
                  <span>386.1 mi²</span>
                  <span>193.1 mi²</span>
                  <span>0 mi²</span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-muted-foreground">
                  <span>02/10</span>
                  <span>09/09</span>
                  <span>10/19</span>
                  <span>11/25</span>
                  <span>12/26</span>
                  <span>01/28</span>
                </div>
              </div>
            </div>

            {/* 俱乐部活动 */}
            <div
              className="bg-yellow-500/20 border border-yellow-500 text-yellow-600 p-4 rounded-lg mt-6 text-center cursor-pointer hover:bg-yellow-500/30 transition-colors"
              onClick={() => toast.info('俱乐部活动详情页面开发中...')}
            >
              <h3 className="font-bold text-lg flex items-center justify-center gap-2">
                <Crown className="w-5 h-5"/>
                跑步俱乐部活动进行中
              </h3>
              <p className="text-sm">点击查看详情</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
