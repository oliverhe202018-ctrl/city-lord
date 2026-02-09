'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Users, Globe, Check, Settings2 } from 'lucide-react';
import { useGameStore, useGameActions } from '@/store/useGameStore';
import { getJoinedRooms } from '@/app/actions/room';
import { Room } from '@/types/room';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoomManagerModal } from './RoomManagerModal';

export interface RoomSelectorProps {
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  compact?: boolean;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onRoomSelect?: () => void;
  children?: React.ReactNode;
}

export function RoomSelector({ 
  side = 'bottom', 
  align = 'center', 
  compact = false, 
  className,
  open,
  onOpenChange,
  onRoomSelect,
  children
}: RoomSelectorProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  
  const isControlled = open !== undefined;
  const showOpen = isControlled ? open : internalOpen;
  const setShowOpen = isControlled ? onOpenChange : setInternalOpen;
  
  const currentRoom = useGameStore((state) => state.currentRoom);
  const joinedRooms = useGameStore((state) => state.joinedRooms);
  const { setCurrentRoom, setJoinedRooms } = useGameActions();
  
  // Load joined rooms on mount
  useEffect(() => {
    const loadRooms = async () => {
      try {
        const result = await getJoinedRooms();
        if (result.success && result.rooms) {
          setJoinedRooms(result.rooms as Room[]);
        }
      } catch (error) {
        console.error('Failed to load joined rooms:', error);
      }
    };
    
    loadRooms();
  }, [setJoinedRooms]);

  const handleRoomSelect = (room: Room) => {
    // 1. Set Active Room
    setCurrentRoom(room);
    
    // 2. Trigger Callback
    if (onRoomSelect) {
      onRoomSelect();
    }

    // Close dropdown if internal state is used (though typically controlled by parent now)
    if (!isControlled && setShowOpen) {
      setShowOpen(false);
    }
  };

  return (
    <>
      <DropdownMenu open={showOpen} onOpenChange={setShowOpen}>
        {/* Mobile Backdrop for Click Outside */}
        {showOpen && (
          <div 
            className="fixed inset-0 z-[99998] bg-transparent" 
            onClick={() => setShowOpen(false)}
            onTouchStart={() => setShowOpen(false)}
          />
        )}
        <DropdownMenuTrigger asChild>
          {children ? children : (
            <div className={cn(
              "relative z-[9999]",
              compact ? "inline-block" : "w-full",
              "rounded-xl",
              className?.includes("flex-shrink-0") ? "" : ""
            )}>
              <Button 
                variant="outline" 
                className={cn(
                  "h-9 px-3 gap-2 justify-between border-white/10 bg-black/20 backdrop-blur-sm hover:bg-white/10 transition-all w-full",
                  currentRoom ? "text-cyan-400 border-cyan-500/30" : "text-muted-foreground",
                  !compact && "min-w-[140px]",
                  className
                )}
              >
                <div className="flex items-center gap-2 truncate max-w-[120px]">
                  {currentRoom ? (
                    <>
                      <Users className="w-4 h-4 shrink-0" />
                      {!compact && <span className="truncate">{currentRoom.name}</span>}
                    </>
                  ) : (
                    <>
                      <Globe className="w-4 h-4 shrink-0" />
                      {!compact && <span>单人模式</span>}
                    </>
                  )}
                </div>
                {!compact && <Settings2 className="w-3 h-3 opacity-50" />}
              </Button>
            </div>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          side={side} 
          align={align}
          className="w-64 bg-slate-900 border-slate-700 text-slate-200 z-[99999]"
        >
          <DropdownMenuLabel className="text-xs text-slate-400 font-medium flex justify-between items-center">
            <span>我的房间</span>
            <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] text-white/60">{joinedRooms.length}</span>
          </DropdownMenuLabel>

          <div className="max-h-[200px] overflow-y-auto custom-scrollbar flex flex-col gap-1 p-1">
             {joinedRooms.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-center text-slate-500">
                    暂未加入任何房间
                  </div>
                ) : (
                  joinedRooms.map((room) => (
                    <DropdownMenuItem 
                      key={room.id}
                      onClick={() => handleRoomSelect(room)}
                      className="flex items-center gap-3 cursor-pointer focus:bg-white/5 focus:text-white rounded-lg"
                    >
                       <div className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          currentRoom?.id === room.id ? "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]" : "bg-cyan-500/30"
                        )} />
                        <span className="flex-1 truncate">{room.name}</span>
                        {currentRoom?.id === room.id && <Check className="w-4 h-4 text-cyan-500" />}
                    </DropdownMenuItem>
                  ))
                )}
          </div>

          <DropdownMenuSeparator className="bg-white/5" />

          <DropdownMenuItem 
            onClick={() => setIsModalOpen(true)}
            className="cursor-pointer focus:bg-cyan-600/20 focus:text-cyan-300 text-cyan-400"
          >
            <Plus className="w-4 h-4 mr-2" />
            <span>加入或创建房间</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RoomManagerModal 
        open={isModalOpen} 
        onOpenChange={setIsModalOpen} 
        onRoomEnter={(roomId) => {
          // Close the modal
          setIsModalOpen(false);
          
          // Trigger the parent's onRoomSelect (which opens RoomDrawer)
          if (onRoomSelect) {
            onRoomSelect();
          }
        }}
      />
    </>
  );
}
