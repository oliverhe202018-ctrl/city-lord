"use client";

import { Eye, EyeOff } from 'lucide-react';

interface TerritoryToggleProps {
  showTerritory: boolean;
  onToggle: (show: boolean) => void;
}

export const TerritoryToggle = ({ showTerritory, onToggle }: TerritoryToggleProps) => {
  return (
    <button
      onClick={() => onToggle(!showTerritory)}
      className="rounded-full bg-white/10 p-3 text-white/80 backdrop-blur-sm hover:bg-white/20 transition-colors"
    >
      {showTerritory ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
    </button>
  );
};
