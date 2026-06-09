import React from 'react';
import { Drawer, DrawerContent, DrawerOverlay } from '@/components/ui/drawer';
import { useQuery } from '@tanstack/react-query';
import { getClubPublicProfile } from '@/app/actions/club';
import { Loader2, Users, MapPin, Trophy, Shield, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ClubProfileSheetProps {
  clubId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClubProfileSheet({ clubId, isOpen, onOpenChange }: ClubProfileSheetProps) {
  const { data: club, isLoading } = useQuery({
    queryKey: ['club-public-profile', clubId],
    queryFn: () => (clubId ? getClubPublicProfile(clubId) : null),
    enabled: !!clubId && isOpen,
  });

  return (
    <Drawer modal={false} open={isOpen} onOpenChange={onOpenChange} dismissible={true}>
      <DrawerOverlay onClick={() => onOpenChange(false)} className="bg-transparent z-[1060] pointer-events-none" />
      <DrawerContent onPointerDownOutside={() => onOpenChange(false)} className="bg-card/95 backdrop-blur-md border-t border-border outline-none max-w-md mx-auto pointer-events-auto z-[1060] flex flex-col max-h-[85vh]">
        <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted mt-2" />
        
        <div className="p-4 flex flex-col gap-4 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">加载俱乐部数据...</span>
            </div>
          ) : !club ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              获取不到俱乐部信息
            </div>
          ) : (
            <>
              {/* Header Info */}
              <div className="flex flex-col items-center gap-3 mt-2">
                <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-primary/20 shadow-lg">
                  {club.avatar_url ? (
                    <img src={club.avatar_url} alt={club.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                      <span className="text-3xl font-bold text-primary">{club.name.substring(0, 1)}</span>
                    </div>
                  )}
                </div>
                
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-bold">{club.name}</h2>
                  <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {club.member_count} 人
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {club.province || '未知'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              {club.description && (
                <div className="bg-muted/30 p-3 rounded-lg mt-2 text-sm text-center text-muted-foreground">
                  {club.description}
                </div>
              )}

              {/* Key Stats Grid */}
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 flex flex-col items-center gap-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Navigation className="w-3.5 h-3.5" /> 总占领面积
                  </span>
                  <span className="text-lg font-black text-primary">
                    {(club.total_area / 1000000).toFixed(2)}
                    <span className="text-xs ml-1 font-normal text-muted-foreground">km²</span>
                  </span>
                </div>
                <div className="bg-orange-500/5 border border-orange-500/10 rounded-xl p-3 flex flex-col items-center gap-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Trophy className="w-3.5 h-3.5 text-orange-500" /> 全国排名
                  </span>
                  <span className="text-lg font-black text-orange-500">
                    {club.rank_national ? `第 ${club.rank_national} 名` : '未上榜'}
                  </span>
                </div>
              </div>

              {/* Top 5 Territories */}
              <div className="mt-4 flex flex-col gap-2">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-blue-500" /> 俱乐部中流砥柱
                  </h3>
                  <span className="text-xs text-muted-foreground">Top 5 成员</span>
                </div>
                
                <div className="flex flex-col gap-2">
                  {club.top_territories && club.top_territories.length > 0 ? (
                    club.top_territories.map((member: any, index: number) => (
                      <div key={member.member_id} className="flex items-center justify-between bg-muted/20 hover:bg-muted/40 transition-colors p-2.5 rounded-lg border border-border/50">
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? 'bg-yellow-500/20 text-yellow-600' : index === 1 ? 'bg-gray-300/40 text-gray-600' : index === 2 ? 'bg-orange-400/20 text-orange-700' : 'bg-muted text-muted-foreground'}`}>
                            {index + 1}
                          </div>
                          <div className="flex items-center gap-2">
                            {member.avatar_url ? (
                              <img src={member.avatar_url} className="w-7 h-7 rounded-full object-cover" alt="" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs">
                                {member.nickname?.substring(0, 1)}
                              </div>
                            )}
                            <span className="text-sm font-medium">{member.nickname}</span>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-foreground">
                          {(member.total_area / 1000000).toFixed(2)} <span className="text-[10px] text-muted-foreground font-normal">km²</span>
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-sm text-muted-foreground bg-muted/10 rounded-lg">
                      暂无成员数据
                    </div>
                  )}
                </div>
              </div>

            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
