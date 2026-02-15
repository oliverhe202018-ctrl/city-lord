
"use client";

import { Trophy, Medal, ChevronUp, ChevronDown, Minus, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { RankData } from "./mock-data";

interface RankItemProps {
  data: RankData;
}

export function RankItem({ data }: RankItemProps) {
  const { rank, name, avatar, score, change, aux, isMe } = data;

  const getRankIcon = (r: number) => {
    switch (r) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-500 fill-yellow-500/20" />;
      case 2:
        return <Trophy className="h-5 w-5 text-gray-400 fill-gray-400/20" />;
      case 3:
        return <Trophy className="h-5 w-5 text-amber-700 fill-amber-700/20" />;
      default:
        return <span className="text-sm font-bold text-muted-foreground w-6 text-center">{r}</span>;
    }
  };

  const getChangeIcon = (c: 'up' | 'down' | 'same') => {
    switch (c) {
      case 'up':
        return <ChevronUp className="h-3 w-3 text-green-500" />;
      case 'down':
        return <ChevronDown className="h-3 w-3 text-red-500" />;
      default:
        return <Minus className="h-3 w-3 text-muted-foreground/50" />;
    }
  };

  return (
    <div className={cn(
      "flex items-center p-3 rounded-xl transition-all duration-200 border",
      isMe 
        ? "bg-primary/10 border-primary/30 shadow-[0_0_15px_rgba(var(--primary),0.1)]" 
        : "bg-white/5 border-white/5 hover:bg-white/10"
    )}>
      {/* Rank */}
      <div className="flex flex-col items-center justify-center w-10 mr-2 gap-1">
        {getRankIcon(rank)}
        <div className="flex items-center">
          {getChangeIcon(change)}
        </div>
      </div>

      {/* Avatar */}
      <Avatar className={cn("h-10 w-10 mr-3 border-2", 
        rank === 1 ? "border-yellow-500" : 
        rank === 2 ? "border-gray-400" : 
        rank === 3 ? "border-amber-700" : "border-transparent"
      )}>
        <AvatarImage src={avatar} alt={name} />
        <AvatarFallback className="bg-muted">
          <User className="h-5 w-5 text-muted-foreground" />
        </AvatarFallback>
      </Avatar>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("font-bold truncate text-sm", isMe ? "text-primary" : "text-foreground")}>
            {name}
          </span>
          {isMe && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">我</span>}
        </div>
        {aux && <div className="text-xs text-muted-foreground truncate">{aux}</div>}
      </div>

      {/* Score */}
      <div className="text-right ml-2">
        <div className="font-mono font-bold text-lg text-primary leading-none">
          {typeof score === 'number' ? score.toLocaleString() : score}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">贡献值</div>
      </div>
    </div>
  );
}
