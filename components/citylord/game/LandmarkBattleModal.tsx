"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface LandmarkBattleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBattleComplete: (success: boolean, score: number) => void;
  landmarkName: string;
}

export function LandmarkBattleModal({ isOpen, onClose, onBattleComplete, landmarkName }: LandmarkBattleModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleMessage = (event: MessageEvent) => {
      // Security check: ensure origin matches if hosted externally
      // if (event.origin !== "https://your-cdn.com") return;
      
      if (event.data && event.data.type === 'BATTLE_RESULT') {
          onBattleComplete(event.data.success, event.data.score);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, onBattleComplete]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-black flex flex-col animate-in fade-in duration-300">
       {/* Header */}
       <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-10 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
             <h2 className="text-white font-bold text-sm uppercase tracking-wider">
                Landmark Battle: <span className="text-[#22c55e]">{landmarkName}</span>
             </h2>
          </div>
          <button 
            onClick={onClose}
            className="pointer-events-auto w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white/80 hover:text-white border border-white/20"
          >
             <X className="w-5 h-5" />
          </button>
       </div>

       {/* Iframe Container */}
       <div className="flex-1 w-full h-full">
          <iframe 
            src="/minigame/index.html" 
            className="w-full h-full border-0"
            allow="autoplay; fullscreen; vibration; gyroscope; accelerometer"
          />
       </div>
    </div>
  );
}
