'use client';

import { useState, useEffect } from 'react';
import { useGameStore, useGameActions } from '@/store/useGameStore';
import { RoomSelector } from '@/components/room/RoomSelector';
import { ClubDrawer } from './ClubDrawer';
import { RoomDrawer } from './RoomDrawer';
import { CreateClubDrawer } from '@/components/citylord/club/CreateClubDrawer';
import { useHydration } from '@/hooks/useHydration';
import { cn } from '@/lib/utils';

export interface ModeSwitcherProps {
  onDrawerOpenChange?: (isOpen: boolean) => void;
}

export function ModeSwitcher({ onDrawerOpenChange }: ModeSwitcherProps) {
  const hydrated = useHydration();
  const gameMode = useGameStore((state) => state.gameMode);
  const activeDrawer = useGameStore((state) => state.activeDrawer);
  const { setGameMode, openDrawer, closeDrawer } = useGameActions();
  
  const [isRoomSelectorOpen, setIsRoomSelectorOpen] = useState(false);

  // Notify parent about drawer state changes if needed
  // But wait, onDrawerOpenChange is passed to detect if ANY drawer is open?
  // In GamePageContent: setShouldHideButtons(isOpen)
  // But ModeSwitcher doesn't know about ALL drawers, only its own?
  // Actually, GamePageContent uses ModeSwitcher to pass this callback...
  // But ModeSwitcher renders ClubDrawer, CreateClubDrawer, RoomDrawer.
  // So when these are open, it should call onDrawerOpenChange(true).
  // But activeDrawer is in store! GamePageContent can just observe store!
  // The prop onDrawerOpenChange seems redundant if we use store.
  // However, I will add the prop to fix the type error and make it work as existing code expects.
  
  useEffect(() => {
    if (onDrawerOpenChange) {
      // If any of the drawers managed by this switcher are open, or room selector
      const isAnyDrawerOpen = activeDrawer === 'club' || activeDrawer === 'createClub' || activeDrawer === 'room';
      onDrawerOpenChange(isAnyDrawerOpen || isRoomSelectorOpen);
    }
  }, [activeDrawer, isRoomSelectorOpen, onDrawerOpenChange]);

  // 核心逻辑：点击“创建”时，关闭列表，打开创建页
  const handleOpenCreateClub = () => {
    // 自动切换抽屉状态
    openDrawer('createClub');
  };

  if (!hydrated) return null;

  return (
    <div className="relative z-[100] mx-auto w-full max-w-md px-4 mt-[88px]">
      <div className="grid grid-cols-3 gap-2 rounded-full bg-card/80 p-1.5 backdrop-blur-md border border-border shadow-lg">
        {/* 1. 地图按钮 */}
        <button 
          onClick={() => setGameMode('map')} 
          className={cn( 
            "relative z-10 flex items-center justify-center rounded-full py-2 text-sm font-medium transition-all duration-200", 
            gameMode === "map" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground" 
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
             setTimeout(() => openDrawer('room'), 100); // 增加 100ms 延迟，防止下拉框关闭动画冲突 
           }} 
        > 
          <button 
            className={cn( 
              "relative z-10 flex items-center justify-center rounded-full py-2 text-sm font-medium transition-all duration-200 w-full", 
              // 只有当下拉菜单打开时才高亮，或者是为了视觉统一保持默认样式 
              isRoomSelectorOpen ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground" 
            )} 
          > 
            {/* 强制静态文本，不再显示房间名 */} 
            房间 
          </button> 
        </RoomSelector> 
        
        {/* 3. 俱乐部按钮 */} 
        <button 
          onClick={() => openDrawer('club')} 
          className="relative z-10 flex items-center justify-center rounded-full py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:text-foreground" 
        > 
          俱乐部 
        </button> 
      </div>
      
      {/* 俱乐部抽屉组件保持不变 */} 
      <ClubDrawer 
        isOpen={activeDrawer === 'club'} 
        onClose={closeDrawer} 
        onOpenCreate={handleOpenCreateClub}
      />
      
      <CreateClubDrawer 
        isOpen={activeDrawer === 'createClub'} 
        onClose={closeDrawer} 
        onSuccess={() => {
           openDrawer('club');
        }}
      />
      
      <RoomDrawer 
        isOpen={activeDrawer === 'room'} 
        onClose={closeDrawer} 
      />
    </div>
  );
}
