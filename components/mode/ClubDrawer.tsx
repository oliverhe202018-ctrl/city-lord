"use client"

import React, { useState } from 'react';
import { useRegion } from '@/contexts/RegionContext';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from '@/components/ui/drawer';
import { leaveClub } from '@/app/actions/club';
import { toast } from 'sonner';
import { useGameStore } from '@/store/useGameStore';
import { createClient } from "@/lib/supabase/client";
import { ClubManageDrawer } from '@/components/citylord/club/ClubManageDrawer';
import { ClubDetailView } from '@/components/citylord/club/ClubDetailView';
import { ClubDiscoveryView } from '@/components/citylord/club/ClubDiscoveryView';
import { useClubData } from '@/hooks/useGameData'; 
import { LeaveClubModal } from '@/components/citylord/club/LeaveClubModal';
import { Loader2 } from 'lucide-react';

interface ClubDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ClubDrawer({ isOpen, onClose }: ClubDrawerProps) {
  // ==================================================================================
  // 1. Hook Definition Area
  // ==================================================================================
  
  // Context & Store Hooks
  const { region } = useRegion();
  const { userId } = useGameStore();
  
  // SWR Hook (Data Fetching)
  const { data: clubData, isLoading: isSwrLoading, mutate: refreshClubs } = useClubData();
  
  // Local State Hooks
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [isManageOpen, setIsManageOpen] = React.useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [clubToLeave, setClubToLeave] = useState<string | null>(null);

  // Derived Data
  const joinedClub = clubData?.joinedClub;
  const allClubs = clubData?.allClubs || [];
  const isLoading = isSwrLoading;

  // Effects
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

    // CASE A: User has a joined club (Active)
    if (joinedClub && joinedClub.status === 'active') {
        return (
            <div className="h-full overflow-y-auto no-scrollbar pb-20">
                <ClubDetailView 
                  clubId={joinedClub.id} 
                  onChange={() => {
                      // Option to leave/change club
                      openLeaveModal(joinedClub.id);
                  }}
                />
            </div>
        );
    }

    // CASE B: User is not in a club (or pending/rejected)
    // Note: If pending, we might want to show a pending state, but for now we treat it as discovery with status
    return (
        <ClubDiscoveryView 
            clubs={allClubs.map((c: any) => ({
                id: c.id,
                name: c.name,
                members: c.member_count || 1,
                territory: c.territory || '0 mi²',
                avatar: c.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${c.name}`,
                isJoined: c.id === joinedClub?.id // Mark if pending
            }))}
            onJoinSuccess={() => refreshClubs()}
            isLoading={isLoading}
        />
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

        {/* Only show generic header if in discovery mode */}
        {(!joinedClub || joinedClub.status !== 'active') && (
            <DrawerHeader className="px-6 pb-2 flex-shrink-0">
            <div className="flex items-center justify-between">
                <div>
                <DrawerTitle className="text-white text-2xl font-bold">
                    跑步俱乐部
                </DrawerTitle>
                <p className="text-white/50 text-sm mt-1">
                    加入俱乐部，与跑友一起进步
                </p>
                </div>
                <DrawerClose className="p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
                <svg className="w-6 h-6 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                </DrawerClose>
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
