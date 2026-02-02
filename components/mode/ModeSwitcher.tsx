
'use client';

import { useState, useEffect } from 'react';
import { useGameStore } from '@/store/useGameStore';
import clsx from 'clsx';
import { GameMode } from '@/store/useGameStore';
import { ModeDrawer } from './ModeDrawer';
import { RoomDrawer } from './RoomDrawer';
import { ClubDrawer } from './ClubDrawer';
import { useHydration } from '@/hooks/useHydration';

const modes: { id: GameMode; name: string }[] = [
  { id: 'map', name: '地图' },
  { id: 'single', name: '模式' },
  { id: 'private', name: '房间' },
  { id: 'club', name: '俱乐部' },
];

interface ModeSwitcherProps {
  onDrawerOpenChange?: (isOpen: boolean) => void;
}

export function ModeSwitcher({ onDrawerOpenChange }: ModeSwitcherProps) {
  const hydrated = useHydration();
  const gameMode = useGameStore((state) => state.gameMode);
  const setGameMode = useGameStore((state) => state.setGameMode);

  const [isModeDrawerOpen, setIsModeDrawerOpen] = useState(false);
  const [isRoomDrawerOpen, setIsRoomDrawerOpen] = useState(false);
  const [isClubDrawerOpen, setIsClubDrawerOpen] = useState(false);

  // 通知父组件抽屉状态变化
  const isAnyDrawerOpen = isModeDrawerOpen || isRoomDrawerOpen || isClubDrawerOpen;

  // 使用 useEffect 而不是 useState 来通知父组件
  useEffect(() => {
    if (onDrawerOpenChange) {
      onDrawerOpenChange(isAnyDrawerOpen);
    }
  }, [isAnyDrawerOpen, onDrawerOpenChange]);

  if (!hydrated) {
    return null;
  }

  const handleModeClick = (modeId: GameMode) => {
    if (modeId === 'map') {
      setGameMode('map');
    } else if (modeId === 'single') {
      setIsModeDrawerOpen(true);
    } else if (modeId === 'private') {
      setIsRoomDrawerOpen(true);
    } else if (modeId === 'club') {
      setIsClubDrawerOpen(true);
    }
  };

  return (
    <>
      {/* Adjusted top position to be closer to MapHeader (approx 60px height for header) */}
      <div className="fixed top-[calc(env(safe-area-inset-top)+60px)] left-1/2 -translate-x-1/2 z-[40] bg-black/40 backdrop-blur-xl p-1.5 rounded-2xl flex items-center gap-1 shadow-lg border border-white/5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
        {modes.map((mode) => {
          const isActive = gameMode === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => handleModeClick(mode.id)}
              className={clsx(
                'px-5 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 focus:outline-none whitespace-nowrap flex-shrink-0',
                {
                  'bg-white text-black shadow-lg shadow-white/20': isActive,
                  'text-white/70 hover:bg-white/10 hover:text-white/90': !isActive,
                }
              )}
            >
              {mode.name}
            </button>
          );
        })}
      </div>

      {/* 抽屉组件 */}
      <ModeDrawer isOpen={isModeDrawerOpen} onClose={() => setIsModeDrawerOpen(false)} />
      <RoomDrawer isOpen={isRoomDrawerOpen} onClose={() => setIsRoomDrawerOpen(false)} />
      <ClubDrawer isOpen={isClubDrawerOpen} onClose={() => setIsClubDrawerOpen(false)} />
    </>
  );
}
