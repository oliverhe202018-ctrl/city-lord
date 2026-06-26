import React from 'react';
import { Drawer, DrawerContent, DrawerOverlay } from '@/components/ui/drawer';
import { ClubDetailView } from '@/components/citylord/club/ClubDetailView';
import { ClubProfileCompactView } from './ClubProfileCompactView';

interface ClubProfileSheetProps {
  clubId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** 精简模式：从 TerritoryDetailSheet 打开时传入 true */
  compact?: boolean;
}

export function ClubProfileSheet({ clubId, isOpen, onOpenChange, compact = false }: ClubProfileSheetProps) {
  return (
    <Drawer modal={false} open={isOpen} onOpenChange={onOpenChange} dismissible={true}>
      <DrawerOverlay onClick={() => onOpenChange(false)} className="bg-transparent z-[1060] pointer-events-none" />
      <DrawerContent onPointerDownOutside={() => onOpenChange(false)} className="bg-card/95 backdrop-blur-md border-t border-border outline-none max-w-md mx-auto pointer-events-auto z-[1060] flex flex-col max-h-[90vh] overflow-y-auto p-0">
        <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted mt-2 mb-2" />
        {clubId && (compact ? <ClubProfileCompactView clubId={clubId} /> : <ClubDetailView clubId={clubId} />)}
      </DrawerContent>
    </Drawer>
  );
}
