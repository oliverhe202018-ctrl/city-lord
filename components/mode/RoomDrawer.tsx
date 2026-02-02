"use client"

import React from 'react';
import { Users, Plus, Search, Lock, Unlock, TrendingUp, MapPin, LogOut, BarChart3, Scale, Swords, Target, Rocket, TrendingDown, CheckCircle2 } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from '@/components/ui/drawer';
import { getRooms, createRoom, joinRoom, leaveRoom, getCurrentRoom, dev_simulateGameUpdate, type Room } from '@/app/actions/room';
import { toast } from 'sonner';
import { PlayerStatsDrawer } from './PlayerStatsDrawer';
import { useGameStore, useGameActions, useGameUser } from '@/store/useGameStore';

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
}

export function RoomDrawer({ isOpen, onClose }: RoomDrawerProps) {
  const userId = useGameStore(state => state.userId);
  const currentRoom = useGameStore(state => state.currentRoom) as any;
  const { setCurrentRoom } = useGameActions();

  if (!userId) return null;

  const [view, setView] = React.useState<'list' | 'create' | 'my_room'>('list');
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  // Dashboard State
  const [activeFilter, setActiveFilter] = React.useState<FilterType>('overall');
  const [participants, setParticipants] = React.useState<ExtendedParticipant[]>([]);
  const [selectedPlayer, setSelectedPlayer] = React.useState<ExtendedParticipant | null>(null);
  const [isStatsOpen, setIsStatsOpen] = React.useState(false);

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

  // Create Form State
  const [formData, setFormData] = React.useState({
    name: '',
    target_distance_km: 3,
    is_private: false,
    password: ''
  });

  const loadRooms = async () => {
    setIsLoading(true);
    try {
      // Check if already in a room
      const myRoom = await getCurrentRoom();
      if (myRoom) {
        setCurrentRoom(myRoom);
        if (myRoom.participants) {
          // Use real data from backend
          let enriched = [...myRoom.participants] as ExtendedParticipant[];

          // If dev environment and not enough data, simulate update to populate
          // (In production, we would just show what we have)
          if (process.env.NODE_ENV === 'development' && enriched.length > 0 && enriched[0].total_score === 0) {
            console.log('Dev: Triggering simulation to populate stats');
            await dev_simulateGameUpdate(myRoom.id);
            // Re-fetch once
            const updatedRoom = await getCurrentRoom();
            if (updatedRoom?.participants) {
              enriched = updatedRoom.participants as ExtendedParticipant[];
            }
          }

          // Initial Sort by active filter (default overall)
          enriched.sort((a, b) => b.total_score - a.total_score);
          setParticipants(enriched);
        }
        setView('my_room');
      } else {
        setCurrentRoom(null); // Sync store with backend
        const list = await getRooms();
        setRooms(list);
        if (view === 'my_room') setView('list');
      }
    } catch (e) {
      console.error(e);
      toast.error('加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset/Load when drawer opens
  React.useEffect(() => {
    if (isOpen) {
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
      loadRooms();
    } catch (e) {
      toast.error('加入失败: ' + (e instanceof Error ? e.message : '未知错误'));
    }
  };

  const handleLeave = async () => {
    if (!currentRoom) return;
    if (!confirm('确定要退出房间吗？')) return;

    try {
      await leaveRoom(currentRoom.id);
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
            <div>
              <DrawerTitle className="text-white text-2xl font-bold">
                {view === 'create' ? '创建私人房间' : view === 'my_room' ? '我的房间' : '选择跑步房间'}
              </DrawerTitle>
              <p className="text-white/50 text-sm mt-1">
                {view === 'create' ? '设置房间参数' : view === 'my_room' ? '等待比赛开始' : '加入好友创建的私人房间'}
              </p>
            </div>
            <DrawerClose className="p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
              <svg className="w-6 h-6 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </DrawerClose>
          </div>
        </DrawerHeader>

        {view === 'my_room' && currentRoom ? (
          <div className="px-6 pb-8 space-y-6">
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-white">{currentRoom.name}</h2>
                  <p className="text-white/50 text-sm">房主: {currentRoom.host_name}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="p-3 rounded-xl bg-black/20">
                  <p className="text-white/40 text-xs mb-1">人数</p>
                  <p className="text-white font-semibold">{currentRoom.participants?.length || 1} / {currentRoom.max_participants}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5">
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

                <p className="text-sm font-medium text-white/70 mb-3">
                  排行榜 ({filters.find(f => f.id === activeFilter)?.label})
                </p>
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
                        <div className="flex items-center justify-center w-6 text-white/40 font-bold font-mono text-sm flex-shrink-0">
                          #{index + 1}
                        </div>
                        <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden relative flex-shrink-0">
                          {/* Avatar placeholder */}
                          <div className="w-full h-full flex items-center justify-center text-sm font-bold text-white/50 bg-gradient-to-br from-white/5 to-white/10">
                            {p.nickname?.[0]}
                          </div>
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
            </div>

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
