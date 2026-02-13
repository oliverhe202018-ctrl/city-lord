"use client"

import React, { useState, useEffect } from 'react';
import { useRegion } from '@/contexts/RegionContext';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from '@/components/ui/drawer';
import { leaveClub } from '@/app/actions/club';
import { toast } from 'sonner';
import { useGameStore } from '@/store/useGameStore';
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from 'next/navigation';
import { ClubManageDrawer } from '@/components/citylord/club/ClubManageDrawer';
import { ClubDetailView } from '@/components/citylord/club/ClubDetailView';
import { ClubDiscoveryView } from '@/components/citylord/club/ClubDiscoveryView';
import { useClubData } from '@/hooks/useGameData'; 
import { LeaveClubModal } from '@/components/citylord/club/LeaveClubModal';
import { Loader2 } from 'lucide-react';

interface ClubDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCreate: () => void;
}

export function ClubDrawer({ isOpen, onClose, onOpenCreate }: ClubDrawerProps) {
  // ==================================================================================
  // 1. Hook Definition Area
  // ==================================================================================
  
  // Navigation
  const router = useRouter();
  const searchParams = useSearchParams();

  // Context & Store Hooks
  const { region } = useRegion();
  const { userId } = useGameStore();
  
  // SWR Hook (Data Fetching)
  const { data: clubData, isLoading: isSwrLoading, mutate: refreshClubs } = useClubData();
  
  // Local State Hooks
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [viewingClubId, setViewingClubId] = React.useState<string | null>(null);
  const [isManageOpen, setIsManageOpen] = React.useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [clubToLeave, setClubToLeave] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [snapPoint, setSnapPoint] = useState<number | string | null>(1);

  // Derived Data
  const joinedClub = clubData?.joinedClub;
  const allClubs = clubData?.allClubs || [];
  const isLoading = isSwrLoading;
  const supabase = React.useMemo(() => createClient(), []);

  const clubsWithAvatars = React.useMemo(() => {
    return allClubs.map((club: any) => {
      const rawAvatar = club.avatar || club.logo_url || club.avatar_url
      let avatarUrl = rawAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${club.name}`
      if (rawAvatar && !/^https?:\/\//i.test(rawAvatar) && !rawAvatar.startsWith('data:')) {
        const { data } = supabase.storage.from('clubs').getPublicUrl(rawAvatar)
        avatarUrl = data.publicUrl
      }
      return { ...club, displayAvatar: avatarUrl }
    })
  }, [allClubs, supabase])

  const [topClubs, setTopClubs] = useState<any[]>([]);

  useEffect(() => {
    // Lazy fetch top clubs when drawer opens or mode changes
    const fetchTopClubs = async () => {
        const { getTopClubsByArea } = await import('@/app/actions/club');
        const data = await getTopClubsByArea();
        setTopClubs(data);
    };
    fetchTopClubs();
  }, []);

  // Effects
  React.useEffect(() => {
    if (!isOpen) {
      setViewingClubId(null);
    }
  }, [isOpen]);

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

  // Handlers
  const handleJoinClub = async (clubId: string) => {
    setIsJoining(true);
    try {
      const { joinClub } = await import('@/app/actions/club');
      const result = await joinClub(clubId);
      if (result.success) {
        toast.success(result.status === 'active' ? '加入成功！' : '申请已提交，等待审核');
        
        // Refresh everything: SWR cache and local viewing state
        await refreshClubs(); 
        
        // If status is active, immediately clear viewingClubId so CASE B takes over (My Club View)
        if (result.status === 'active') {
            setViewingClubId(null);
        }
        
        // Wait a tick for SWR to update
        setTimeout(() => {
            // No manual state change needed if SWR updates 'joinedClub'
        }, 100);

        return true;
      } else {
        toast.error(result.error || '加入失败');
        return false;
      }
    } catch (e) {
      toast.error('请求失败');
      return false;
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveClub = async () => {
    if (!clubToLeave) return;

    try {
      await leaveClub(clubToLeave);
      toast.success('已退出俱乐部');
      setIsLeaveModalOpen(false);
      setClubToLeave(null);
      refreshClubs(); // Refresh to switch view automatically
    } catch (error) {
      toast.error('退出失败', {
        description: error instanceof Error ? error.message : '请稍后重试'
      });
    }
  };

  const openLeaveModal = (clubId: string) => {
    setClubToLeave(clubId);
    setIsLeaveModalOpen(true);
  };

  const handleCloseDetail = () => {
    setViewingClubId(null);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="px-6 py-6 space-y-6 animate-pulse h-full">
          {/* Header Area Skeleton */}
          <div className="space-y-2">
             <div className="h-8 w-48 bg-zinc-800 rounded-lg" />
             <div className="h-4 w-64 bg-zinc-800/50 rounded-lg" />
          </div>

          {/* Banner/Card Skeleton */}
          <div className="w-full h-32 bg-zinc-800 rounded-2xl border border-white/5" />

          {/* Action Bar Skeleton */}
          <div className="flex gap-3">
             <div className="h-12 flex-1 bg-zinc-800 rounded-xl" />
             <div className="h-12 w-24 bg-zinc-800 rounded-xl" />
          </div>

          {/* List Items Skeleton */}
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-800/30 border border-white/5">
                 <div className="w-14 h-14 rounded-xl bg-zinc-800 flex-shrink-0" />
                 <div className="flex-1 space-y-2">
                    <div className="h-5 w-32 bg-zinc-800 rounded" />
                    <div className="h-3 w-24 bg-zinc-800/50 rounded" />
                 </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // CASE A: Viewing a specific club detail (from list click)
    if (viewingClubId) {
        // If user has a joined club, redirect to their club detail instead of showing another one
        // Unless they are just viewing it? But user asked for "jump to self club detail page"
        // Let's enforce: if joinedClub is active, always show joined club details.
        // This is actually handled by CASE B being below.
        // Wait, if viewingClubId is set, it enters CASE A and returns.
        // So we should check joinedClub here too.
        
        if (joinedClub && joinedClub.status === 'active') {
             // Redirect logic: If user clicked a club but is already a member of one (maybe via deep link or race condition),
             // show their own club instead.
             // We can just fall through to CASE B by returning null here? No, renderContent must return JSX.
             // We can just render the Joined Club View here.
             return (
                <div className="h-auto w-full">
                    <ClubDetailView 
                      clubId={joinedClub.id} 
                      isJoined={true}
                      onChange={() => openLeaveModal(joinedClub.id)}
                    />
                </div>
            );
        }

        const isMember = joinedClub?.id === viewingClubId && joinedClub?.status === 'active';
        return (
            <div className={`w-full ${isMember ? "h-auto" : "h-full"}`}>
                 <ClubDetailView 
                   clubId={viewingClubId} 
                   isJoined={isMember}
                   onJoin={() => handleJoinClub(viewingClubId)}
                   isJoining={isJoining}
                   topClubs={topClubs}
                   onChange={() => {
                       if (isMember) {
                           openLeaveModal(viewingClubId);
                       } else {
                           handleCloseDetail(); // Back to list
                       }
                   }}
                   onBack={handleCloseDetail}
                 />
             </div>
        );
    }

    // CASE B: User has a joined club (Active) -> Show Detail directly
    if (joinedClub && joinedClub.status === 'active') {
        return (
            <div className="h-auto w-full">
                <ClubDetailView 
                  clubId={joinedClub.id} 
                  isJoined={true}
                  onChange={() => {
                      // Option to leave/change club
                      openLeaveModal(joinedClub.id);
                  }}
                />
            </div>
        );
    }

    // CASE C: User is not in a club (or pending/rejected) -> Show List
    // Note: If pending, we might want to show a pending state, but for now we treat it as discovery with status
    return (
        <ClubDiscoveryView 
            clubs={clubsWithAvatars.map((c: any) => ({
                id: c.id,
                name: c.name,
                members: c.member_count || 1,
                territory: c.territory || '0 mi²',
                avatar: c.displayAvatar,
                isJoined: c.id === joinedClub?.id
            }))}
            onJoinSuccess={() => refreshClubs()}
            isLoading={isLoading}
            onOpenCreate={onOpenCreate}
            onViewClub={(id) => setViewingClubId(id)}
        />
    );
  };

  const isViewingJoined = joinedClub && joinedClub.status === 'active';

  return (
    <Drawer 
      open={isOpen} 
      onOpenChange={onClose} 
      snapPoints={[0.4, 1]}
      activeSnapPoint={snapPoint}
      onActiveSnapPointChange={setSnapPoint}
      dismissible={true}
      repositionInputs={false}
    >
      <DrawerContent
        className="bg-background border-t border-border rounded-t-[32px] w-full overflow-x-hidden flex flex-col h-[96vh]"
      >
        <div className="flex justify-center pt-4 pb-2 flex-shrink-0 relative">
          <div className="w-12 h-1.5 bg-muted rounded-full" />
          
          {/* Global Close Button */}
          <div className="absolute right-4 top-0">
             <DrawerClose className="p-2 rounded-full bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
             </DrawerClose>
          </div>
        </div>

        {/* Only show generic header if in discovery mode AND list view AND not viewing detail */}
        {(!joinedClub || joinedClub.status !== 'active') && !viewingClubId && (
            <DrawerHeader className="px-6 pb-2 flex-shrink-0">
            <div className="flex items-center justify-between">
                <div>
                <DrawerTitle className="text-foreground text-2xl font-bold">
                    跑步俱乐部
                </DrawerTitle>
                <p className="text-muted-foreground text-sm mt-1">
                    加入俱乐部，与跑友一起进步
                </p>
                </div>
            </div>
            </DrawerHeader>
        )}

        {renderContent()}

        <ClubManageDrawer
          isOpen={isManageOpen}
          onClose={() => setIsManageOpen(false)}
          club={joinedClub ? {
            id: joinedClub.id,
            name: joinedClub.name,
            description: joinedClub.description,
            avatar_url: joinedClub.avatar_url,
            owner_id: joinedClub.owner_id
          } : undefined}
        />

        <LeaveClubModal
          isOpen={isLeaveModalOpen}
          onClose={() => setIsLeaveModalOpen(false)}
          onConfirm={handleLeaveClub}
        />
      </DrawerContent>
    </Drawer>
  );
}
