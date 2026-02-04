"use client"

import React from 'react';
import { useRegion } from '@/contexts/RegionContext';
import { Users, MapPin, TrendingUp, Crown, CheckCircle2, Search, Star, Plus, Settings, Shield, UserX, AlertTriangle, Loader2 } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from '@/components/ui/drawer';
import { joinClub, leaveClub, createClub } from '@/app/actions/club';
import { toast } from 'sonner';
import { useGameStore } from '@/store/useGameStore';
import { createClient } from "@/lib/supabase/client";
import { ClubManageDrawer } from '@/components/citylord/club/ClubManageDrawer';
import ClubDetails from './ClubDetails';
import { useClubData } from '@/hooks/useGameData'; // Import SWR hook

interface ClubDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

type ViewMode = 'list' | 'create' | 'details';

export function ClubDrawer({ isOpen, onClose }: ClubDrawerProps) {
  const { region } = useRegion();
  const { province, cityName, countyName } = region || {};
  const locationName = (cityName && cityName !== 'undefined' ? cityName : '') ||
    (countyName && countyName !== 'undefined' ? countyName : '') ||
    '城市';

  const provinceName = (province && province !== 'undefined') ? province : '中国';

  const { userId } = useGameStore();
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [isManageOpen, setIsManageOpen] = React.useState(false);
  
  // Use SWR Hook
  const { data: clubData, isLoading: isSwrLoading, mutate: refreshClubs } = useClubData();
  const joinedClub = clubData?.joinedClub;
  const allClubs = clubData?.allClubs;

  React.useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
      }
    }
    checkUser()
  }, []);

  const [viewMode, setViewMode] = React.useState<ViewMode>('list');
  const [createForm, setCreateForm] = React.useState({
    name: '',
    description: '',
  });

  const [clubs, setClubs] = React.useState<any[]>([]);
  const [selectedClub, setSelectedClub] = React.useState<any | null>(null);
  const [isLoading, setIsLoading] = React.useState(true); // Keep local loading state for smooth UX

  // Sync SWR data to local state
  React.useEffect(() => {
      // 1. Hook logic must be unconditional
      if (allClubs) {
          const mappedClubs = allClubs.map((c: any) => ({
            id: c.id,
            name: c.name,
            members: c.member_count || 1,
            territory: c.territory || '0 mi²',
            avatar: c.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${c.name}`,
            rating: c.rating || 5.0,
            isJoined: c.id === joinedClub?.id, 
            owner_id: c.owner_id,
            level: c.level || '初级',
            description: c.description
          }));
          
          setClubs(mappedClubs);
          setIsLoading(false);
          
          // Auto-Enter Logic
          if (joinedClub && joinedClub.id) {
             // Fix: Check if we are already in the correct view to avoid loop
             if (viewMode === 'list' && isOpen) {
                // Fix: Check if we haven't already selected this club to avoid loop
                if (selectedClub?.id !== joinedClub.id) {
                    const userClub = mappedClubs.find((c: any) => c.id === joinedClub.id);
                    if (userClub) {
                        setSelectedClub(userClub);
                        setViewMode('details');
                    }
                }
             }
          }
      } else if (!isSwrLoading && !allClubs) {
          setIsLoading(false); // No data but loaded
      }
  }, [allClubs, joinedClub, isOpen, isSwrLoading]); // Depend on SWR data

  // Old loadData effect removed (replaced by SWR)



  const handleClubClick = (clubName: string) => {
    const club = clubs.find(c => c.name === clubName);
    if (club) {
      setSelectedClub(club);
      setViewMode('details');
    }
  };

  const handleCreateClub = async (e?: React.FormEvent) => {
    // 1. Prevent default form submission if triggered by form
    if (e) e.preventDefault();

    if (!createForm.name.trim()) {
      toast.error('请输入俱乐部名称');
      return;
    }

    try {
      const result = await createClub({
        name: createForm.name,
        description: createForm.description,
        avatar_url: `https://api.dicebear.com/7.x/shapes/svg?seed=${createForm.name}`
      });

      if (!result.success || !result.data) {
        toast.error('创建失败', {
          description: result.error || '请稍后重试'
        });
        return;
      }

      const newClub = result.data;

      toast.success('俱乐部创建成功！');

      // Add to local list (Mock logic for immediate feedback)
      const mockNewClub = {
        id: newClub.id,
        name: newClub.name,
        members: 1,
        territory: '0 mi²',
        avatar: newClub.avatar_url || 'https://picsum.photos/id/67/64/64',
        rating: 5.0,
        isJoined: true,
        owner_id: currentUserId || 'current_user',
        level: '初级'
      };

      setClubs(prev => [mockNewClub, ...prev]);
      setSelectedClub(mockNewClub);
      setViewMode('details');
      setCreateForm({ name: '', description: '' });
      
      // Trigger global refresh
      refreshClubs();

    } catch (error) {
      toast.error('创建失败', {
        description: error instanceof Error ? error.message : '请稍后重试'
      });
    }
  };

  const handleJoinClub = async (clubId: string) => {
    try {
      const result = await joinClub(clubId);
      
      if (!result.success) {
          toast.error('申请失败', {
            description: result.error || '请稍后重试'
          });
          return;
      }

      toast.success('申请已发送', {
        description: '请等待俱乐部管理员审核'
      });
      // Update local state and selected club
      const updater = (prevClubs: any[]) => prevClubs.map(c =>
        c.id === clubId ? { ...c, isJoined: true } : c
      );
      setClubs(updater);
      setSelectedClub((prev: any) => prev ? { ...prev, isJoined: true } : null);

    } catch (error) {
      toast.error('申请失败', {
        description: error instanceof Error ? error.message : '请稍后重试'
      });
    }
  };

  const handleLeaveClub = async (clubId: string) => {
    try {
      if (!confirm('确定要退出俱乐部吗？')) return;

      await leaveClub(clubId);
      toast.success('已退出俱乐部');

      // Update local state
      const updater = (prevClubs: any[]) => prevClubs.map(c =>
        c.id === clubId ? { ...c, isJoined: false } : c
      );
      setClubs(updater);
      setSelectedClub((prev: any) => prev ? { ...prev, isJoined: false } : null);

      // Logic: If I leave, should I go back to list?
      // Yes, usually.
      setViewMode('list');
      setSelectedClub(null);

    } catch (error) {
      toast.error('退出失败', {
        description: error instanceof Error ? error.message : '请稍后重试'
      });
    }
  };

  // Reset view when closing
  React.useEffect(() => {
    if (!isOpen) {
      // Delay reset to allow drawer closing animation
      const timer = setTimeout(() => {
        // Do not force reset here if we want to remember state? 
        // No, user specifically asked for "Enter -> Details if joined".
        // So on re-open, logic in useEffect([isOpen]) handles it.
        // We can clear state here to be clean.
        setViewMode('list');
        setSelectedClub(null);
        setIsLoading(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const isOwner = selectedClub?.owner_id === currentUserId;

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-white/50 text-sm">正在加载俱乐部数据...</p>
        </div>
      );
    }

    if (viewMode === 'create') {
      return (
        <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-8">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">俱乐部名称</label>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="给你的俱乐部起个响亮的名字"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">简介</label>
              <textarea
                value={createForm.description}
                onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="介绍一下俱乐部的宗旨..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 transition-all resize-none"
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="button"
              onClick={handleCreateClub}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold text-lg hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
            >
              立即创建
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="w-full mt-3 py-3 rounded-xl bg-white/5 text-white/60 font-medium hover:bg-white/10 transition-all"
            >
              返回列表
            </button>
          </div>
        </div>
      );
    }

    if (viewMode === 'details' && selectedClub) {
      // Use the Reusable ClubDetails Component
      // We wrap it to provide the interactive buttons that ClubDetails might not have internally
      // or we let ClubDetails handle it. 
      // The previous embedded code had "Join/Leave" buttons.
      // The ClubDetails.tsx we saw has tabs but NOT the Join/Leave/Manage main buttons at bottom.
      // It has MemberCard, etc.
      // Let's render ClubDetails, and APPEND the action buttons at the bottom if needed?
      // Or better, let ClubDetails strictly display info, and we keep the action bar here?
      // The user said "previously available functions need to be restored".
      // The embedded version had "Manage/Leave/Join".
      // The Separate File `ClubDetails.tsx` seems to be for "My Club" view where you ARE a member.
      // So it lacks "Join" button logic usually.
      // Let's render ClubDetails, and render our Action Bar below it.

      return (
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto">
            <ClubDetails club={selectedClub} onBack={() => {
              setViewMode('list');
              setSelectedClub(null);
            }} />
          </div>

          {/* Fixed Action Bar at Bottom */}
          <div className="p-6 border-t border-white/10 bg-black/20 pb-8 flex-shrink-0">
            <button
              onClick={() => {
                if (isOwner) {
                  setIsManageOpen(true);
                } else if (selectedClub.isJoined) {
                  handleLeaveClub(selectedClub.id);
                } else {
                  handleJoinClub(selectedClub.id);
                }
              }}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all active:scale-95 ${isOwner
                ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 shadow-lg shadow-purple-500/20'
                : selectedClub.isJoined
                  ? 'bg-white/10 text-white hover:bg-white/20'
                  : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/20'
                }`}
            >
              {isOwner ? '管理俱乐部' : (selectedClub.isJoined ? '退出俱乐部' : '申请加入')}
            </button>
            {!selectedClub.isJoined && (
              <button
                onClick={() => {
                  setViewMode('list');
                  setSelectedClub(null);
                }}
                className="w-full mt-3 py-3 rounded-xl bg-transparent text-white/40 font-medium hover:text-white hover:bg-white/5 transition-all"
              >
                返回列表
              </button>
            )}
          </div>
        </div>
      );
    }

    // Default: List View
    return (
      <>
        <div className="px-6 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="搜索俱乐部名称..."
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 text-sm focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all"
            />
          </div>

          <button
            onClick={() => setViewMode('create')}
            className="w-full mt-3 py-3 rounded-xl bg-white/5 border border-white/10 border-dashed text-white/60 font-medium hover:bg-white/10 hover:text-white hover:border-white/30 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            创建我的俱乐部
          </button>
        </div>

        <div className="px-6 py-2 space-y-3 overflow-y-auto flex-1 pb-8 no-scrollbar">
          {clubs.map((club) => (
            <div
              key={club.id}
              onClick={() => handleClubClick(club.name)}
              className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer active:scale-95"
            >
              <div className="flex items-start gap-4">
                <div className="relative flex-shrink-0">
                  <img
                    src={club.avatar}
                    alt={club.name}
                    className="w-16 h-16 rounded-2xl object-cover"
                  />
                  {club.level === '顶级' && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center">
                      <Crown className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white font-bold text-base truncate">{club.name}</h3>
                    {club.isJoined && (
                      <span className="flex items-center gap-1 text-green-400 text-xs flex-shrink-0">
                        <CheckCircle2 className="w-3 h-3" />
                        {club.owner_id === currentUserId ? '所有者' : '已加入'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 mb-2">
                    {Array(5).fill(0).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3 h-3 ${i < Math.floor(club.rating)
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-white/20'
                          }`}
                        fill={i < Math.floor(club.rating) ? 'currentColor' : 'none'}
                      />
                    ))}
                    <span className="text-white/60 text-xs ml-1">{club.rating}</span>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5 text-white/70">
                      <Users className="w-3 h-3" />
                      <span>{club.members.toLocaleString()} 位成员</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-white/70">
                      <MapPin className="w-3 h-3" />
                      <span>{club.territory}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-white/5">
                <div
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold text-sm hover:from-blue-600 hover:to-blue-700 transition-all flex items-center justify-center"
                >
                  {club.isJoined ? (club.owner_id === currentUserId ? '管理俱乐部' : '查看详情') : '加入俱乐部'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  };

  return (
    <Drawer open={isOpen} onOpenChange={onClose} snapPoints={[0.4, 0.95]}>
      <DrawerContent
        className="bg-zinc-900/90 border-t border-white/10 rounded-t-[32px] w-full overflow-x-hidden flex flex-col h-full max-h-[96vh]"
      >
        <div className="flex justify-center pt-4 pb-2 flex-shrink-0">
          <div className="w-12 h-1.5 bg-white/20 rounded-full" />
        </div>

        <DrawerHeader className="px-6 pb-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DrawerTitle className="text-white text-2xl font-bold">
                {viewMode === 'create' ? '创建俱乐部' : (viewMode === 'details' ? '俱乐部详情' : '跑步俱乐部')}
              </DrawerTitle>
              <p className="text-white/50 text-sm mt-1">
                {viewMode === 'create' ? '创建属于你的跑者社区' : (viewMode === 'details' ? '查看俱乐部详细信息' : '加入俱乐部，与跑友一起进步')}
              </p>
            </div>
            <DrawerClose className="p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
              <svg className="w-6 h-6 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </DrawerClose>
          </div>
        </DrawerHeader>

        {renderContent()}

        <ClubManageDrawer
          isOpen={isManageOpen}
          onClose={() => setIsManageOpen(false)}
          club={selectedClub ? {
            id: selectedClub.id,
            name: selectedClub.name,
            description: selectedClub.description,
            avatar_url: selectedClub.avatar,
            owner_id: selectedClub.owner_id
          } : undefined}
        />
      </DrawerContent>
    </Drawer>
  );
}
