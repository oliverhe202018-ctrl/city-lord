"use client"

import React from 'react';
// 补全所有漏掉的图标
import { 
  Users, Plus, Search, Lock, Unlock, TrendingUp, MapPin, LogOut, 
  BarChart3, Scale, Swords, Target, Rocket, TrendingDown, CheckCircle2,
  UserPlus, 
  MessageSquare, // 修复 MessageSquare is not defined
  Info,          // 修复 Info is not defined (详情页图标)
  Map as MapIcon // 修复 MapIcon is not defined (领地图标)
} from 'lucide-react';

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from '@/components/ui/drawer';
import { getRooms, createRoom, joinRoom, leaveRoom, type Room } from '@/app/actions/room';
import { toast } from 'sonner';
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
  const { setCurrentRoom } = useGameActions();
  
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

  // Early return 必须在 Hooks 定义之后
  if (!userId) return null;

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
      await createRoom({
        name: formData.name,
        target_distance_km: formData.target_distance_km,
        is_private: formData.is_private,
        password: formData.password
      });
      console.log('createRoom success');
      toast.success('创建成功');
      loadRooms(); // Will switch to my_room
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
      setCurrentRoom(room); // Update store
      refreshRoom(); // Refetch SWR
      setView('my_room');
    } catch (e) {
      toast.error('加入失败: ' + (e instanceof Error ? e.message : '未知错误'));
    }
  };

  const handleLeave = async () => {
    if (!activeRoom) return;
    if (!confirm('确定要退出房间吗？')) return;

    try {
      await leaveRoom(activeRoom.id);
      toast.success('已退出房间');
      setCurrentRoom(null);
      setView('list');
      loadRooms();
    } catch (e) {
      toast.error('退出失败');
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={onClose} snapPoints={[0.4, 0.95]}>
      <DrawerContent
        className="bg-zinc-900/90 border-t border-white/10 rounded-t-[32px] w-full overflow-x-hidden flex flex-col h-full max-h-[96vh]"
      >
        {/* 顶部拖拽手柄 */}
        <div className="flex justify-center pt-4 pb-2">
          <div className="w-12 h-1.5 bg-white/20 rounded-full" />
        </div>

        <DrawerHeader className="px-6 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <DrawerTitle className="text-white text-2xl font-bold flex items-center gap-2">
                {view === 'create' ? '创建私人房间' : view === 'my_room' ? activeRoom?.name || '我的房间' : view === 'invite' ? '邀请好友' : '选择跑步房间'}
                {view === 'my_room' && activeRoom && (activeRoom.host_id === userId || activeRoom.allow_member_invite) && (
                  <button 
                    onClick={() => setView('invite')}
                    className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors ml-2"
                  >
                    <UserPlus className="w-4 h-4 text-cyan-400" />
                  </button>
                )}
              </DrawerTitle>
              <p className="text-white/50 text-sm mt-1">
                {view === 'create' ? '设置房间参数' : view === 'my_room' ? `房主: ${activeRoom?.host_name || 'Unknown'}` : view === 'invite' ? '分享房间码' : '加入好友创建的私人房间'}
              </p>
            </div>
            <DrawerClose className="p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
              <svg className="w-6 h-6 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </DrawerClose>
          </div>
        </DrawerHeader>

        {view === 'invite' && activeRoom ? (
          <InviteRoomView room={activeRoom} onBack={() => setView('my_room')} />
        ) : view === 'my_room' && activeRoom ? (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Tab Navigation */}
            <div className="px-6 border-b border-white/5">
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
                      activeTab === tab.id ? 'text-cyan-400' : 'text-white/40 hover:text-white/60'
                    }`}
                  >
                    <tab.icon className="w-5 h-5" />
                    <span className="text-[10px] font-medium">{tab.label}</span>
                    {activeTab === tab.id && (
                      <div className="absolute bottom-0 w-full h-0.5 bg-cyan-400 rounded-t-full" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
              {activeTab === 'info' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="pt-4 border-t border-white/5">
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
                    <div className="p-3 rounded-xl bg-black/20">
                      <p className="text-white/40 text-xs mb-1">人数</p>
                      <p className="text-white font-semibold">{activeRoom.participants?.length || 1} / {activeRoom.max_participants}</p>
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
                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                            }`}
                        >
                          <f.icon className="w-5 h-5" />
                          <span className="text-[10px] font-medium">{f.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-white/70">
                      当前排行 ({filters.find(f => f.id === activeFilter)?.label})
                    </p>
                    <div className="text-xs text-white/30">实时更新</div>
                  </div>
                  
                  <div className="space-y-2">
                    {participants.map((p, index) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedPlayer(p);
                          setIsStatsOpen(true);
                        }}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-transparent hover:border-white/10 text-left group"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`flex items-center justify-center w-6 font-bold font-mono text-sm flex-shrink-0 ${
                            index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-600' : 'text-white/40'
                          }`}>
                            #{index + 1}
                          </div>
                          <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden relative flex-shrink-0">
                            {p.avatar ? (
                              <img src={p.avatar} alt={p.nickname} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-sm font-bold text-white/50 bg-gradient-to-br from-white/5 to-white/10">
                                {p.nickname?.[0]}
                              </div>
                            )}
                            {p.status === 'running' && (
                              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#18181b]" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-white font-medium group-hover:text-blue-400 transition-colors truncate">{p.nickname}</div>
                            <div className="text-white/40 text-xs flex items-center gap-1">
                              {new Date(p.joined_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 加入
                            </div>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0 ml-2">
                          <div className="text-white font-bold font-mono text-lg">
                            {activeFilter === 'overall' && p.total_score}
                            {activeFilter === 'ratio' && `${p.territory_ratio}%`}
                            {activeFilter === 'rivals' && p.rivals_defeated}
                            {activeFilter === 'stealers' && p.stolen_lands}
                            {activeFilter === 'gainers' && `+${p.growth_rate}%`}
                            {activeFilter === 'losers' && p.lost_lands}
                          </div>
                          <div className="text-xs text-white/40">
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
                <div className="flex flex-col items-center justify-center h-full text-white/30 py-12 animate-in fade-in zoom-in-95">
                  <MapIcon className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-sm">领地视图即将上线</p>
                  <p className="text-xs mt-1">Coming Soon</p>
                </div>
              )}
            </div>
          </div>
        ) : view === 'create' ? (
          <div className="px-6 pb-8 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/70">房间名称</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="输入房间名称"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white/70">目标距离 (km)</label>
                <div className="flex gap-2">
                  {[3, 5, 10].map(km => (
                    <button
                      key={km}
                      onClick={() => setFormData({ ...formData, target_distance_km: km })}
                      className={`flex-1 py-2 rounded-lg border text-white transition-all cursor-pointer active:scale-95 ${formData.target_distance_km === km
                        ? 'bg-blue-600 border-blue-500'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
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
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-600"
                />
                <label htmlFor="private" className="text-sm text-white/70">设为私密房间（需要密码）</label>
              </div>

              {formData.is_private && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <label className="text-sm font-medium text-white/70">房间密码</label>
                  <input
                    type="text"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    placeholder="设置访问密码"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50 transition-all"
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
      </DrawerContent>
      <PlayerStatsDrawer
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        player={selectedPlayer}
      />
    </Drawer>
  );
}
