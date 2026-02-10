import React, { useState, useEffect } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface RouteSaveDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => Promise<void>;
  initialName?: string;
  distance: number; // in km
  captureArea: number; // in sq km
  previewPath?: string; // SVG path data
  mode?: 'save' | 'update';
  loading?: boolean;
}

export function RouteSaveDrawer({
  open,
  onOpenChange,
  onSave,
  initialName = '',
  distance,
  captureArea,
  previewPath,
  mode = 'save',
  loading = false
}: RouteSaveDrawerProps) {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (open) {
      setName(initialName || '');
    }
  }, [open, initialName]);

  const handleSave = async () => {
    if (!name.trim()) return;
    await onSave(name);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-black/90 border-t border-white/10 text-white z-[200]">
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle className="text-2xl font-bold text-center">
              {mode === 'save' ? 'Save Route' : 'Update Route'}
            </DrawerTitle>
            <DrawerDescription className="text-center text-white/50">
              {mode === 'save'
                ? 'Give your route a memorable name.'
                : 'Update the name of your route.'}
            </DrawerDescription>
          </DrawerHeader>

          <div className="p-4 space-y-6">
            {/* Map Preview */}
            <div className="w-full h-32 bg-black/40 rounded-xl border border-white/10 flex items-center justify-center overflow-hidden relative">
                {previewPath ? (
                    <svg viewBox="0 0 100 100" className="w-full h-full p-4" preserveAspectRatio="xMidYMid meet">
                        <path d={previewPath} fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                ) : (
                    <div className="text-white/20 text-sm">No Preview Available</div>
                )}
            </div>

            {/* Stats Preview */}
            <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10">
              <div className="text-center flex-1 border-r border-white/10">
                <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Distance</div>
                <div className="text-xl font-bold text-cyan-400">
                  {distance.toFixed(2)} <span className="text-sm text-white/50">km</span>
                </div>
              </div>
              <div className="text-center flex-1">
                <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Capture Area</div>
                <div className="text-xl font-bold text-purple-400">
                  {captureArea.toFixed(2)} <span className="text-sm text-white/50">km²</span>
                </div>
              </div>
            </div>

            {/* Input */}
            <div className="space-y-2">
              <Label htmlFor="route-name" className="text-white/70">Route Name</Label>
              <Input
                id="route-name"
                placeholder="e.g. Morning Loop"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-cyan-500"
              />
            </div>
          </div>

          <DrawerFooter>
            <Button
              onClick={handleSave}
              disabled={!name.trim() || loading}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold h-12 rounded-xl"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                mode === 'save' ? 'Save Route' : 'Save Update'
              )}
            </Button>
            <DrawerClose asChild>
              <Button variant="outline" className="w-full border-white/10 text-white hover:bg-white/10 hover:text-white">
                Cancel
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
