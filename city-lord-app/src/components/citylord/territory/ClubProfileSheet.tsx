import React from 'react';
import { Drawer, DrawerContent, DrawerOverlay } from '@/components/ui/drawer';
import { ClubDetailView } from '@/components/citylord/club/ClubDetailView';

interface ClubProfileSheetProps {
  clubId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClubProfileSheet({ clubId, isOpen, onOpenChange }: ClubProfileSheetProps) {
  return (
    <Drawer modal={false} open={isOpen} onOpenChange={onOpenChange} dismissible={true}>
      <DrawerOverlay onClick={() => onOpenChange(false)} className="bg-transparent z-[1060] pointer-events-none" />
      <DrawerContent onPointerDownOutside={() => onOpenChange(false)} className="bg-card/95 backdrop-blur-md border-t border-border outline-none max-w-md mx-auto pointer-events-auto z-[1060] flex flex-col max-h-[90vh] overflow-y-auto p-0">
        <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted mt-2 mb-2" />
        {clubId && <ClubDetailView clubId={clubId} />}
      </DrawerContent>
    </Drawer>
  );
}
