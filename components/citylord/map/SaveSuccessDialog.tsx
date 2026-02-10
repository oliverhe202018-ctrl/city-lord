import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

interface SaveSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
  onViewList: () => void;
}

export function SaveSuccessDialog({
  open,
  onOpenChange,
  onContinue,
  onViewList
}: SaveSuccessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-black/90 border border-white/10 text-white sm:max-w-md z-[200]">
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Route Saved!</DialogTitle>
            <DialogDescription className="text-white/60">
              Your route has been saved successfully to your collection.
            </DialogDescription>
          </DialogHeader>
        </div>
        <DialogFooter className="flex-col sm:justify-center gap-2 mt-4">
           <Button
            onClick={onViewList}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold h-11"
          >
            View My Routes
          </Button>
          <Button
            variant="ghost"
            onClick={onContinue}
            className="w-full text-white/70 hover:text-white hover:bg-white/10"
          >
            Continue Planning
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
