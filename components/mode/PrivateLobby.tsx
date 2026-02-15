
'use client';

import { useState, memo, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { mockPublicRooms } from '@/data/public-rooms';
import { RoomCard } from './RoomCard';
import type { PublicRoom } from '@/data/public-rooms';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export const PrivateLobby = memo(function PrivateLobby() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Use SWR for data fetching with caching
  const { data: serverRooms, mutate } = useSWR<any[]>('/api/room/get-rooms', fetcher, {
    revalidateOnFocus: false, // Prevent re-fetching when window gains focus
    dedupingInterval: 60000,  // Cache for 1 minute
    fallbackData: [],         // Initial empty state
  });

  // Transform server data to UI format
  const rooms: PublicRoom[] = useMemo(() => {
    if (!serverRooms || serverRooms.length === 0) return mockPublicRooms;
    
    return serverRooms.map(r => ({
      id: r.id,
      name: r.name,
      memberCount: r.participants_count || r.memberCount || 0,
      maxMembers: r.max_participants || r.maxMembers || 10,
      distance: (r.target_distance_km || 0) * 1000,
      isPrivate: r.is_private || false,
    }));
  }, [serverRooms]);

  // 使用 useCallback 确保函数引用稳定
  const handleCreateRoom = useCallback(async () => {
    const roomName = prompt('请输入房间名称:');
    if (!roomName) return;

    const maxMembersStr = prompt('请输入最大人数 (2-10):', '10');
    if (maxMembersStr === null) return;
    const maxMembers = parseInt(maxMembersStr);
    
    if (isNaN(maxMembers) || maxMembers < 2 || maxMembers > 10) {
      alert('人数必须在 2-10 之间！');
      return;
    }

    // Optimistic Update
    const tempId = `temp-${Date.now()}`;
    const newRoom: PublicRoom = {
      id: tempId,
      name: roomName,
      memberCount: 1,
      maxMembers,
      distance: 0,
      isPrivate: false,
    };

    // Update local cache immediately
    mutate((currentData: any[] = []) => {
        return [{
            id: tempId,
            name: roomName,
            participants_count: 1,
            max_participants: maxMembers,
            target_distance_km: 0,
            is_private: false
        }, ...currentData];
    }, false);

    try {
        const res = await fetch('/api/room/create-room', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: roomName, max_participants: maxMembers })
        });
        
        if (!res.ok) throw new Error('Failed to create room');
        
        toast.success(`房间 "${roomName}" 创建成功！`);
        // Re-fetch to get real ID
        mutate();
    } catch (e) {
        console.error(e);
        toast.error('创建房间失败');
        // Revert on error
        mutate();
    }
  }, [mutate]);

  const handleJoinRoom = useCallback(async () => {
    const roomId = prompt('请输入房间ID:');
    if (!roomId) return;

    // API Call
    try {
        const res = await fetch('/api/room/join-room', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId })
        });

        if (res.ok) {
            toast.success('加入房间成功');
            mutate(); // Refresh list
        } else {
            const err = await res.json();
            toast.error(err.error || '加入房间失败');
        }
    } catch (e) {
        toast.error('加入请求失败');
    }
  }, [mutate]); 

  const handleRoomJoin = useCallback(async (room: PublicRoom) => {
    if (room.isPrivate) {
      const password = prompt('请输入房间密码:');
      if (password === null) return;

      // Verify password via API (Need specific API for this, fallback to generic join for now)
      // Assuming generic join handles password if we pass it, but current UI mock logic was simple '1234'
      // We will stick to simple mock logic for private rooms unless we upgrade the API
      if (password === '1234') {
         // Mock success for private
         toast.success(`成功加入房间: ${room.name}`);
      } else {
         alert('密码错误！');
      }
    } else {
      // Public room join
      try {
          const res = await fetch('/api/room/join-room', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ roomId: room.id })
          });
          
          if (res.ok) {
              toast.success(`成功加入房间: ${room.name}`);
              mutate();
          } else {
              toast.error('加入失败');
          }
      } catch (e) {
          toast.error('网络错误');
      }
    }
  }, [mutate]);

  return (
    <div className="p-4 text-white">
      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <button
          onClick={handleCreateRoom}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition-colors"
        >
          创建房间
        </button>
        <button
          onClick={handleJoinRoom}
          className="bg-zinc-600 hover:bg-zinc-700 text-white font-bold py-3 rounded-lg transition-colors"
        >
          加入房间
        </button>
      </div>

      {/* Room List */}
      <h2 className="text-xl font-bold mb-4">公开房间</h2>
      {rooms.length === 0 ? (
        <div className="text-center py-8 text-white/60">
          <p>暂无可用房间</p>
          <p className="text-sm mt-2">创建一个房间开始吧！</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} onJoin={handleRoomJoin} />
          ))}
        </div>
      )}
    </div>
  );
});
