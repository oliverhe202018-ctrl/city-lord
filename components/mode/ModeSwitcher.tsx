'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { RoomSelector } from '@/components/room/RoomSelector';
import { ClubDrawer } from './ClubDrawer';
import { RoomDrawer } from './RoomDrawer';
import { useHydration } from '@/hooks/useHydration';
import { cn } from '@/lib/utils';

export function ModeSwitcher() {
  const hydrated = useHydration();
  const gameMode = useGameStore((state) => state.gameMode);
  const setGameMode = useGameStore((state) => state.setGameMode);
  
  const [isRoomSelectorOpen, setIsRoomSelectorOpen] = useState(false);
  const [isClubDrawerOpen, setIsClubDrawerOpen] = useState(false);
  const [isRoomDrawerOpen, setIsRoomDrawerOpen] = useState(false);

  if (!hydrated) return null;

  return (
    <div className="absolute left-1/2 z-[100] w-full max-w-md -translate-x-1/2 px-4 top-[calc(env(safe-area-inset-top)+4rem)]">
      <div className="grid grid-cols-3 gap-2 rounded-full bg-black/80 p-1.5 backdrop-blur-md border border-white/10 shadow-lg">
        {/* 1. 地图按钮 */}
        <button 
          onClick={() => setGameMode('map')} 
          className={cn( 
            "relative z-10 flex items-center justify-center rounded-full py-2 text-sm font-medium transition-all duration-200", 
            gameMode === "map" ? "bg-white text-black shadow-sm" : "text-white/70 hover:text-white" 
          )} 
        > 
          地图 
        </button> 
        
        {/* 2. 房间按钮 (带下拉菜单) */} 
        <RoomSelector 
          open={isRoomSelectorOpen} 
          onOpenChange={setIsRoomSelectorOpen} 
          side="bottom" 
          align="center" 
          onRoomSelect={() => { 
             console.log("Room Selected! Opening Drawer..."); // 添加调试日志 
             setIsRoomSelectorOpen(false); 
             setTimeout(() => setIsRoomDrawerOpen(true), 100); // 增加 100ms 延迟，防止下拉框关闭动画冲突 
           }} 
        > 
          <button 
            className={cn( 
              "relative z-10 flex items-center justify-center rounded-full py-2 text-sm font-medium transition-all duration-200 w-full", 
              // 只有当下拉菜单打开时才高亮，或者是为了视觉统一保持默认样式 
              isRoomSelectorOpen ? "bg-white/10 text-white" : "text-white/70 hover:text-white" 
            )} 
          > 
            {/* 强制静态文本，不再显示房间名 */} 
            房间 
          </button> 
        </RoomSelector> 
        
        {/* 3. 俱乐部按钮 */} 
        <button 
          onClick={() => setIsClubDrawerOpen(true)} 
          className="relative z-10 flex items-center justify-center rounded-full py-2 text-sm font-medium text-white/70 transition-all duration-200 hover:text-white" 
        > 
          俱乐部 
        </button> 
      </div>
      
      {/* 俱乐部抽屉组件保持不变 */} 
      <ClubDrawer isOpen={isClubDrawerOpen} onClose={() => setIsClubDrawerOpen(false)} />
      
      <RoomDrawer 
        isOpen={isRoomDrawerOpen} 
        onClose={() => setIsRoomDrawerOpen(false)} 
      />
    </div>
  );
}
