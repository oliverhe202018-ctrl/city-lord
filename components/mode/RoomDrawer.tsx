"use client"

import React from 'react';
// 补全所有漏掉的图标
import { 
  Users, Plus, Search, Lock, Unlock, TrendingUp, MapPin, LogOut, 
  BarChart3, Scale, Swords, Target, Rocket, TrendingDown, CheckCircle2,
  UserPlus, 
  MessageSquare, // 修复 MessageSquare is not defined
  Info,          // 修复 Info is not defined (详情页图标)
  Map as MapIcon, // 修复 MapIcon is not defined (领地图标)
  Copy, Share2,   // Added Copy and Share2
  ChevronLeft
} from 'lucide-react';

import { motion, AnimatePresence } from 'framer-motion';
import type { Room } from '@/app/actions/room';
import { toast } from 'sonner';

const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit, timeoutMs = 15000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const getRooms = async () => {
  const res = await fetchWithTimeout('/api/room/get-rooms', { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch rooms')
  return await res.json()
}

const createRoom = async (payload: {
  name: string
  target_distance_km: number
  is_private: boolean
  password?: string
}) => {
  const res = await fetchWithTimeout('/api/room/create-room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to create room')
  return await res.json()
}

const joinRoom = async (roomId: string, password?: string) => {
  const res = await fetchWithTimeout('/api/room/join-room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId, password }),
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to join room')
  return await res.json()
}

const leaveRoom = async (roomId: string) => {
  const res = await fetchWithTimeout('/api/room/leave-room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId }),
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to leave room')
  return await res.json()
}
import { PlayerStatsDrawer } from './PlayerStatsDrawer';
import { useGameStore, useGameActions, useGameUser } from '@/store/useGameStore';
import { useMyRoomData, useRoomDetails } from '@/hooks/useGameData';

// ★★★ 这一行必须加，否则等会报 InviteRoomView is not defined ★★★
import { InviteRoomView } from './InviteRoomView';
import { RoomChat } from './RoomChat';

// Mock Extended Types
interface ExtendedParticipant {
  id: string;
  nickname: string;
  joined_at: string;
  avatar?: string;
  level: number;
  total_score: number;
  territory_area: number;
  territory_ratio: number;
  stolen_lands: number;
  lost_lands: number;
  rivals_defeated: number;
  growth_rate: number;
  status: 'active' | 'offline' | 'running';
}

type FilterType = 'overall' | 'ratio' | 'rivals' | 'stealers' | 'gainers' | 'losers';

interface RoomDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  // selectedRoomId?: string; // We use store now
}

export function RoomDrawer({ isOpen, onClose }: RoomDrawerProps) {
  // 1. 状态定义
  const [view, setView] = React.useState<'list' | 'create' | 'my_room' | 'invite'>('list');
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'leaderboard' | 'chat' | 'territory' | 'info'>('leaderboard');
  const [snapPoint, setSnapPoint] = React.useState<number | string | null>(1);

  // Dashboard State
  const [activeFilter, setActiveFilter] = React.useState<FilterType>('overall');
  const [participants, setParticipants] = React.useState<ExtendedParticipant[]>([]);
  const [selectedPlayer, setSelectedPlayer] = React.useState<ExtendedParticipant | null>(null);
  const [isStatsOpen, setIsStatsOpen] = React.useState(false);

  // Create Form State
  const [formData, setFormData] = React.useState({
    name: '',
    target_distance_km: 3,
    is_private: false,
    password: ''
  });

  const { userId, nickname, avatar, currentRoom: selectedRoom } = useGameStore(state => state);
  const { setCurrentRoom, removeJoinedRoom, addJoinedRoom } = useGameActions();
  
  // 1. Fetch My Room (Background/Default) - "My Joined Room"
  const { data: myRoomData } = useMyRoomData();
  
  // 2. Fetch Details for Selected Room (High Priority)
  // If selectedRoom is set (e.g. from Dropdown), fetch its fresh details
  const { data: roomDetails, mutate: refreshRoom } = useRoomDetails(selectedRoom?.id);

  // 3. Determine Active Room
  // Priority: Fresh Details > Store Selection > My Joined Room
  const activeRoom = React.useMemo(() => {
      // If we have fresh details for the selected room, use them
      if (roomDetails && !('error' in roomDetails)) return roomDetails;
      
      // If we have a selection but no details yet, use the partial selection
      if (selectedRoom) return selectedRoom;
      
      // Fallback: If no selection, use "My Room"
      if (myRoomData && !('error' in myRoomData)) return myRoomData;
      
      return null;
  }, [roomDetails, selectedRoom, myRoomData]);

  // Filter Logic
  const handleFilterChange = (type: FilterType) => {
    setActiveFilter(type);
    const sorted = [...participants].sort((a, b) => {
      switch (type) {
        case 'overall': return b.total_score - a.total_score;
        case 'ratio': return b.territory_ratio - a.territory_ratio;
        case 'rivals': return b.rivals_defeated - a.rivals_defeated;
        case 'stealers': return b.stolen_lands - a.stolen_lands;
        case 'gainers': return b.growth_rate - a.growth_rate;
        case 'losers': return b.lost_lands - a.lost_lands;
        default: return 0;
      }
    });
    setParticipants(sorted);
    toast.success(`已切换视图: ${filters.find(f => f.id === type)?.label}`);
  };

  const filters = [
    { id: 'overall', label: '综合数据', icon: BarChart3 },
    { id: 'ratio', label: '占领比', icon: Scale },
    { id: 'rivals', label: '竞争对手', icon: Swords },
    { id: 'stealers', label: '偷取榜', icon: Target },
    { id: 'gainers', label: '增长榜', icon: Rocket },
    { id: 'losers', label: '失地榜', icon: TrendingDown },
  ] as const;

  const loadRooms = async () => {
    setIsLoading(true);
    try {
      if (activeRoom) {
        // If we have an active room (either selected or my room), show it
        if (activeRoom.participants) {
          // Use real data from backend
          let enriched = [...activeRoom.participants] as ExtendedParticipant[];

          // If dev environment and not enough data, simulate update to populate
          if (process.env.NODE_ENV === 'development' && enriched.length > 0 && enriched[0].total_score === 0) {
            // ... (Dev simulation logic) ...
          }

          enriched.sort((a, b) => b.total_score - a.total_score);
          setParticipants(enriched);
        }
        setView('my_room');
      } else {
        // No room found, show list
        const list = await getRooms();
        setRooms(list);
        if (view === 'my_room') setView('list');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // React to Room Updates
  React.useEffect(() => {
    if (activeRoom) {
       // Only switch view if we are not creating or inviting
       if (view === 'list') setView('my_room');
       
       // Update participants list
       if (activeRoom.participants) {
         let enriched = [...activeRoom.participants] as ExtendedParticipant[];
         enriched.sort((a, b) => b.total_score - a.total_score);
         setParticipants(enriched);
       }
    }
  }, [activeRoom]); 

  // Auto-Select My Room if nothing selected
  React.useEffect(() => {
      if (!selectedRoom && myRoomData && !('error' in myRoomData)) {
          setCurrentRoom(myRoomData);
      }
  }, [myRoomData, selectedRoom, setCurrentRoom]);

  // Reset/Load when drawer opens
  React.useEffect(() => {
    if (isOpen) {
      refreshRoom(); // Trigger SWR revalidation
      loadRooms();
    } else {
      // Reset view delayed
      const timer = setTimeout(() => {
        if (view !== 'my_room') setView('list');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Early return MUST be after all hooks
  if (!userId) return null;

  const handleCreate = async () => {
    if (!formData.name) {
      toast.error('请输入房间名称');
      return;
    }
    if (formData.is_private && !formData.password) {
      toast.error('请设置密码');
      return;
    }

    try {
      console.log('Starting createRoom', formData);
      const result = await createRoom({
        name: formData.name,
        target_distance_km: formData.target_distance_km,
        is_private: formData.is_private,
        password: formData.password
      });

      if (result.success && result.room) {
        console.log('createRoom success');
        toast.success('创建成功');
        addJoinedRoom(result.room); // Sync to global store
        setCurrentRoom(result.room);
        loadRooms(); // Will switch to my_room
      } else {
        toast.error(result.error || '创建失败');
      }
    } catch (e) {
      console.error('createRoom failed', e);
      toast.error('创建失败: ' + (e instanceof Error ? e.message : '未知错误'));
    }
  };

  const handleJoin = async (room: Room) => {
    let password = undefined;
    if (room.is_locked) {
      password = prompt('请输入房间密码');
      if (!password) return;
    }

    try {
      await joinRoom(room.id, password);
      toast.success(`成功加入：${room.name}`);
      addJoinedRoom(room); // Sync to global store
      setCurrentRoom(room); // Update store
      refreshRoom(); // Refetch SWR
      setView('my_room');
    } catch (e) {
      toast.error('加入失败: ' + (e instanceof Error ? e.message : '未知错误'));
    }
  };

  const [isCopied, setIsCopied] = React.useState(false);

  const handleCopyInviteCode = () => {
    if (activeRoom?.invite_code) {
      navigator.clipboard.writeText(activeRoom.invite_code);
      toast.success('邀请码已复制');
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleShareInvite = async () => {
    if (!activeRoom?.invite_code) return;
    
    const shareText = `来加入我的CityLord跑步房间"${activeRoom.name}"！邀请码：${activeRoom.invite_code}`;
    
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: '加入CityLord房间',
          text: shareText,
        });
      } catch (err) {
        console.log('Share canceled');
      }
    } else {
      handleCopyInviteCode();
    }
  };

  const handleLeave = async () => {
    if (!activeRoom) return;
    
    const isHost = activeRoom.host_id === userId;
    const confirmMessage = isHost 
        ? '您是房主，退出后房间将被解散，所有成员将被移除。确定要继续吗？' 
        : '确定要退出房间吗？';

    if (!confirm(confirmMessage)) return;

    try {
      const result = await leaveRoom(activeRoom.id);
      
      if (result.success) {
          toast.success(result.dissolved ? '房间已解散' : '已退出房间');
          removeJoinedRoom(activeRoom.id); // Sync to global store
          setCurrentRoom(null);
          
          // Close drawer
          onClose();
          
          // Switch view back to list for next open
          setView('list');
          
          // Refresh list
          loadRooms();
          
          // Force refresh my room data
          // useMyRoomData hook will auto-refresh on mount, but we can try to force it via key mutation if needed.
          // Since we closed drawer, next open will re-fetch.
      } else {
          toast.error(result.error || '退出失败');
      }
    } catch (e) {
      toast.error('退出失败');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed inset-0 z-[200] bg-background flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center px-4 py-3 border-b border-border pt-[calc(env(safe-area-inset-top)+12px)] bg-background/80 backdrop-blur-md z-10 shrink-0">
            <button 
              onClick={onClose}
              className="p-2 -ml-2 rounded-full hover:bg-muted/50 active:scale-95 transition-all text-foreground"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex-1 ml-2 overflow-hidden">
              <h1 className="text-lg font-bold flex items-center gap-2 truncate text-foreground">
                {view === 'create' ? '创建私人房间' : view === 'my_room' ? activeRoom?.name || '我的房间' : view === 'invite' ? '邀请好友' : '跑步房间'}
                {view === 'my_room' && activeRoom && (activeRoom.host_id === userId || activeRoom.allow_member_invite) && (
                  <button 
                    onClick={() => setView('invite')}
                    className="p-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors flex-shrink-0"
                  >
                    <UserPlus className="w-4 h-4 text-primary" />
                  </button>
                )}
              </h1>
              <p className="text-muted-foreground text-xs truncate">
                {view === 'create' ? '设置房间参数' : view === 'my_room' ? `房主: ${activeRoom?.host_name || 'Unknown'}` : view === 'invite' ? '分享房间码' : '加入好友创建的私人房间'}
              </p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden relative">

        {view === 'invite' && activeRoom ? (
          <InviteRoomView room={activeRoom} onBack={() => setView('my_room')} />
        ) : view === 'my_room' && activeRoom ? (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Tab Navigation */}
            <div className="px-6 border-b border-border">
              <div className="grid grid-cols-4 w-full">
                {[
                  { id: 'leaderboard', label: '排行榜', icon: BarChart3 },
                  { id: 'chat', label: '聊天室', icon: MessageSquare },
                  { id: 'territory', label: '领地', icon: MapIcon },
                  { id: 'info', label: '房间详情', icon: Info },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex flex-col items-center justify-center py-3 gap-1 relative transition-colors ${
                      activeTab === tab.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <tab.icon className="w-5 h-5" />
                    <span className="text-[10px] font-medium">{tab.label}</span>
                    {activeTab === tab.id && (
                      <div className="absolute bottom-0 w-full h-0.5 bg-primary rounded-t-full" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
              {activeTab === 'info' && activeRoom && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* Invitation Card */}
                  <div className="bg-muted/50 rounded-xl p-4 border border-border space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">房间邀请码</span>
                      <div className="flex gap-2">
                         <button 
                           onClick={handleCopyInviteCode}
                           className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                         >
                           {isCopied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                         </button>
                         <button 
                           onClick={handleShareInvite}
                           className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                         >
                           <Share2 className="w-4 h-4" />
                         </button>
                      </div>
                    </div>
                    
                    <div className="flex justify-center py-2">
                       <div className="text-3xl font-mono font-bold tracking-[0.2em] text-primary">
                         {activeRoom.invite_code || '------'}
                       </div>
                    </div>
                    
                    <button 
                      onClick={handleShareInvite}
                      className="w-full py-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-sm font-medium transition-colors"
                    >
                      分享给好友
                    </button>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <button
                      onClick={handleLeave}
                      className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 font-bold hover:bg-red-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <LogOut className="w-5 h-5" />
                      退出房间
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'leaderboard' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="p-3 rounded-xl bg-muted">
                      <p className="text-muted-foreground text-xs mb-1">人数</p>
                      <p className="text-foreground font-semibold">{activeRoom.participants?.length || 1} / {activeRoom.max_participants}</p>
                    </div>
                  </div>

                  <div className="pt-2">
                    {/* Dashboard Filters */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {filters.map(f => (
                        <button
                          key={f.id}
                          onClick={() => handleFilterChange(f.id)}
                          className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${activeFilter === f.id
                            ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                            : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                            }`}
                        >
                          <f.icon className="w-5 h-5" />
                          <span className="text-[10px] font-medium">{f.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground/70">
                      当前排行 ({filters.find(f => f.id === activeFilter)?.label})
                    </p>
                    <div className="text-xs text-muted-foreground">实时更新</div>
                  </div>
                  
                  <div className="space-y-2">
                    {participants.map((p, index) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedPlayer(p);
                          setIsStatsOpen(true);
                        }}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-all border border-transparent hover:border-border text-left group"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`flex items-center justify-center w-6 font-bold font-mono text-sm flex-shrink-0 ${
                            index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-600' : 'text-muted-foreground'
                          }`}>
                            #{index + 1}
                          </div>
                          <div className="w-10 h-10 rounded-full bg-muted overflow-hidden relative flex-shrink-0">
                            {p.avatar ? (
                              <img src={p.avatar} alt={p.nickname} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-sm font-bold text-muted-foreground bg-gradient-to-br from-muted to-muted/80">
                                {p.nickname?.[0]}
                              </div>
                            )}
                            {p.status === 'running' && (
                              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-foreground font-medium group-hover:text-blue-400 transition-colors truncate">{p.nickname}</div>
                            <div className="text-muted-foreground text-xs flex items-center gap-1">
                              {new Date(p.joined_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 加入
                            </div>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0 ml-2">
                          <div className="text-foreground font-bold font-mono text-lg">
                            {activeFilter === 'overall' && p.total_score}
                            {activeFilter === 'ratio' && `${p.territory_ratio}%`}
                            {activeFilter === 'rivals' && p.rivals_defeated}
                            {activeFilter === 'stealers' && p.stolen_lands}
                            {activeFilter === 'gainers' && `+${p.growth_rate}%`}
                            {activeFilter === 'losers' && p.lost_lands}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {activeFilter === 'overall' && '得分'}
                            {activeFilter === 'ratio' && '占比'}
                            {activeFilter === 'rivals' && '击败'}
                            {activeFilter === 'stealers' && '偷取'}
                            {activeFilter === 'gainers' && '增长'}
                            {activeFilter === 'losers' && '丢失'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'chat' && (
                <div className="h-full flex flex-col animate-in fade-in zoom-in-95 duration-300 overflow-hidden pb-2">
                   <RoomChat 
                     roomId={activeRoom.id} 
                     participants={participants} // 这一行非常重要，把排行榜的数据传进去用于显示头像
                     currentUser={{
                       id: userId!,
                       nickname: nickname || '我',
                       avatar: avatar
                     }}
                   />
                </div>
              )}

              {activeTab === 'territory' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-foreground/70">领地动态</p>
                    <div className="text-xs text-muted-foreground">最新获取</div>
                  </div>
                  
                  {/* Territory Events Timeline */}
                  <div className="space-y-6 relative pl-4 border-l border-border ml-2 pb-2">
                    {(() => {
                      // Mock Data with Dates - In production, this should come from API and be sorted
                      const events = [
                        { 
                          id: '1', 
                          user: participants[0] || { nickname: 'SpeedRunner', avatar: null }, 
                          time: '10分钟前', 
                          date: '今天',
                          distance: 5.2, 
                          location: '朝阳公园·北区',
                          thumbnail: null 
                        },
                        { 
                          id: '2', 
                          user: participants[1] || { nickname: 'CityWalker', avatar: null }, 
                          time: '32分钟前', 
                          date: '今天',
                          distance: 3.8, 
                          location: '奥林匹克森林公园',
                          thumbnail: null 
                        },
                        { 
                          id: '3', 
                          user: participants[2] || { nickname: 'NightOwl', avatar: null }, 
                          time: '14:30', 
                          date: '昨天',
                          distance: 8.5, 
                          location: '亮马河畔',
                          thumbnail: null 
                        },
                        { 
                          id: '4', 
                          user: participants[0] || { nickname: 'SpeedRunner', avatar: null }, 
                          time: '09:15', 
                          date: '2023-10-24',
                          distance: 4.1, 
                          location: '三里屯商圈',
                          thumbnail: null 
                        }
                      ];

                      // Grouping
                      const groups = events.reduce((acc, event) => {
                        if (!acc[event.date]) acc[event.date] = [];
                        acc[event.date].push(event);
                        return acc;
                      }, {} as Record<string, typeof events>);

                      return Object.entries(groups).map(([date, groupEvents]) => (
                        <div key={date} className="relative">
                           {/* Date Header Node */}
                           <div className="absolute -left-[21px] top-0.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background z-10" />
                           <div className="text-xs font-bold text-muted-foreground mb-3 pl-0">{date}</div>
                           
                           <div className="space-y-3">
                             {groupEvents.map((event) => (
                               <div key={event.id} className="relative group">
                                  {/* Small event dot */}
                                  <div className="absolute -left-[19px] top-4 w-1.5 h-1.5 rounded-full bg-border group-hover:bg-primary transition-colors" />
                                  
                                  <div className="bg-muted/50 rounded-xl p-3 border border-border hover:bg-muted transition-all cursor-pointer active:scale-95">
                                     <div className="flex items-start gap-3">
                                       {/* User Avatar */}
                                       <div className="w-8 h-8 rounded-full bg-muted overflow-hidden flex-shrink-0">
                                         {event.user.avatar ? (
                                           <img src={event.user.avatar} alt={event.user.nickname} className="w-full h-full object-cover" />
                                         ) : (
                                           <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                                             {event.user.nickname?.[0]}
                                           </div>
                                         )}
                                       </div>
                                       
                                       <div className="flex-1 min-w-0">
                                         <div className="flex justify-between items-start">
                                           <span className="text-sm font-medium text-foreground truncate">{event.user.nickname}</span>
                                           <span className="text-xs text-muted-foreground">{event.time}</span>
                                         </div>
                                         
                                         <div className="text-xs text-muted-foreground mt-0.5">
                                           占领了 <span className="text-primary font-medium">{event.location}</span>
                                         </div>
                                         
                                         <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                                            <div className="flex items-center gap-1">
                                              <TrendingUp className="w-3 h-3 text-green-400" />
                                              <span>{event.distance}km</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <MapIcon className="w-3 h-3 text-blue-400" />
                                              <span>查看详情</span>
                                            </div>
                                         </div>
                                       </div>
                                       
                                       {/* Thumbnail Placeholder */}
                                       <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden border border-border flex-shrink-0 flex items-center justify-center">
                                         {event.thumbnail ? (
                                           <img src={event.thumbnail} className="w-full h-full object-cover" />
                                         ) : (
                                           <MapIcon className="w-6 h-6 text-muted-foreground/50" />
                                         )}
                                       </div>
                                     </div>
                                  </div>
                               </div>
                             ))}
                           </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : view === 'create' ? (
          <div className="px-6 pb-32 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">房间名称</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="输入房间名称"
                  className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">目标距离 (km)</label>
                <div className="flex gap-2">
                  {[3, 5, 10].map(km => (
                    <button
                      key={km}
                      onClick={() => setFormData({ ...formData, target_distance_km: km })}
                      className={`flex-1 py-2 rounded-lg border text-foreground transition-all cursor-pointer active:scale-95 ${formData.target_distance_km === km
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'bg-muted/50 border-border hover:bg-muted'
                        }`}
                    >
                      {km}km
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="private"
                  checked={formData.is_private}
                  onChange={e => setFormData({ ...formData, is_private: e.target.checked })}
                  className="w-4 h-4 rounded border-border bg-muted/50 text-primary"
                />
                <label htmlFor="private" className="text-sm text-muted-foreground">设为私密房间（需要密码）</label>
              </div>

              {formData.is_private && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <label className="text-sm font-medium text-muted-foreground">房间密码</label>
                  <input
                    type="text"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    placeholder="设置访问密码"
                    className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setView('list')}
                className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-semibold hover:bg-white/10 transition-all cursor-pointer active:scale-95"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/20 transition-all cursor-pointer active:scale-95"
              >
                立即创建
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 搜索框 */}
            <div className="px-6 pb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  placeholder="搜索房间名称..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 text-sm focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all"
                />
              </div>
            </div>

            {/* 房间列表 */}
            <div className="px-6 py-2 space-y-3 overflow-y-auto max-h-[calc(85vh-200px)] pb-8 no-scrollbar">
              {isLoading ? (
                <div className="text-center py-8 text-white/40">加载中...</div>
              ) : rooms.length === 0 ? (
                <div className="text-center py-8 text-white/40">暂无房间，快来创建一个吧</div>
              ) : (
                rooms.map((room) => (
                  <div
                    key={room.id}
                    onClick={() => handleJoin(room)}
                    className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer active:scale-95"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-white font-bold text-base">{room.name}</h3>
                          {room.is_locked ? (
                            <Lock className="w-3 h-3 text-yellow-500" />
                          ) : (
                            <Unlock className="w-3 h-3 text-green-500" />
                          )}
                        </div>
                        <p className="text-white/50 text-xs">房主: {room.host_name}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1.5 text-white/70">
                        <Users className="w-3 h-3" />
                        <span>{room.participants_count}/{room.max_participants}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-white/70">
                        <MapPin className="w-3 h-3" />
                        <span>{room.target_distance_km ? `${room.target_distance_km}km` : '自由'}</span>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-white/5">
                      <div
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold text-sm hover:from-blue-600 hover:to-blue-700 transition-all flex items-center justify-center cursor-pointer"
                      >
                        {room.is_locked ? '需要密码' : '加入房间'}
                      </div>
                    </div>
                  </div>
                )))}

              <button
                onClick={() => setView('create')}
                className="w-full p-4 rounded-2xl border-2 border-dashed border-white/10 hover:border-white/20 hover:bg-white/5 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Plus className="w-5 h-5 text-white/50" />
                <span className="text-white/50 font-medium">创建新房间</span>
              </button>
            </div>
          </>
        )}
          </div>
          <PlayerStatsDrawer
            isOpen={isStatsOpen}
            onClose={() => setIsStatsOpen(false)}
            player={selectedPlayer}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
