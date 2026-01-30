
'use client';

import { useState } from 'react';
import { mockPublicRooms } from '@/data/public-rooms';
import { RoomCard } from './RoomCard';
import type { PublicRoom } from '@/data/public-rooms';

export function PrivateLobby() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [rooms, setRooms] = useState(mockPublicRooms);

  const handleCreateRoom = () => {
    const roomName = prompt('请输入房间名称:');
    if (!roomName) return;

    const maxMembers = parseInt(prompt('请输入最大人数 (2-10):', '10') || '10');
    if (isNaN(maxMembers) || maxMembers < 2 || maxMembers > 10) {
      alert('人数必须在 2-10 之间！');
      return;
    }

    const newRoom: PublicRoom = {
      id: `room-${Date.now()}`,
      name: roomName,
      memberCount: 1,
      maxMembers,
      distance: 0,
      isPrivate: false,
    };

    setRooms([newRoom, ...rooms]);
    alert(`房间 "${roomName}" 创建成功！`);
  };

  const handleJoinRoom = () => {
    const roomId = prompt('请输入房间ID:');
    if (!roomId) return;

    const room = rooms.find(r => r.id === roomId);
    if (room) {
      if (room.memberCount >= room.maxMembers) {
        alert('该房间已满！');
        return;
      }

      setRooms(rooms.map(r =>
        r.id === roomId ? { ...r, memberCount: r.memberCount + 1 } : r
      ));
      alert(`成功加入房间: ${room.name}`);
    } else {
      alert('未找到该房间，请检查房间ID！');
    }
  };

  const handleRoomJoin = (room: PublicRoom) => {
    if (room.isPrivate) {
      const password = prompt('请输入房间密码:');
      if (password === null) return;

      if (password === '1234') {
        setRooms(rooms.map(r =>
          r.id === room.id ? { ...r, memberCount: r.memberCount + 1 } : r
        ));
        alert(`成功加入房间: ${room.name}`);
      } else {
        alert('密码错误！');
      }
    } else {
      setRooms(rooms.map(r =>
        r.id === room.id ? { ...r, memberCount: r.memberCount + 1 } : r
      ));
      alert(`成功加入房间: ${room.name}`);
    }
  };

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
}
