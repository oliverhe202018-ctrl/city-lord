
'use client';

import type { PublicRoom } from '@/data/public-rooms';
import { Users, Lock, AlertCircle } from 'lucide-react';

interface RoomCardProps {
  room: PublicRoom;
  onJoin?: (room: PublicRoom) => void;
}

export function RoomCard({ room, onJoin }: RoomCardProps) {
  const isFull = room.memberCount >= room.maxMembers;

  const handleJoin = () => {
    if (isFull) {
      alert('房间已满，无法加入！');
      return;
    }

    if (onJoin) {
      onJoin(room);
    } else {
      alert(`已加入房间: ${room.name}`);
    }
  };

  return (
    <div className="bg-zinc-800/50 p-4 rounded-lg flex items-center justify-between transition-all hover:bg-zinc-700/50">
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-lg flex items-center truncate">
          {room.name}
          {room.isPrivate && <Lock className="w-4 h-4 ml-2 text-yellow-400 flex-shrink-0" />}
        </h3>
        <p className="text-sm text-white/60 mt-1 whitespace-nowrap">距离: {(room.distance / 1000).toFixed(1)} km</p>
      </div>
      <div className="flex flex-col items-end ml-4 flex-shrink-0">
        <div className={`flex items-center gap-1 ${isFull ? 'text-red-400' : 'text-white/80'}`}>
          <Users className="w-4 h-4 flex-shrink-0" />
          <span className="font-mono whitespace-nowrap">{room.memberCount}/{room.maxMembers}</span>
          {isFull && <AlertCircle className="w-3 h-3" />}
        </div>
        <button
          onClick={handleJoin}
          disabled={isFull}
          className={`mt-2 px-4 py-1.5 rounded-full text-sm font-bold transition-colors whitespace-nowrap ${
            isFull
              ? 'bg-zinc-600 text-zinc-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isFull ? '已满' : '加入'}
        </button>
      </div>
    </div>
  );
}
