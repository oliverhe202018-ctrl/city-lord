"use client";

import React, { useState, useEffect } from "react";
import { VirtualList } from "@/components/ui/virtual-list";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Mock Data Type
interface LeaderboardItem {
  id: string;
  rank: number;
  name: string;
  score: number;
  avatar: string;
  guild: string;
}

// Generate Mock Data
const generateData = (count: number, startRank: number = 1): LeaderboardItem[] => {
  return Array.from({ length: count }).map((_, i) => ({
    id: `user-${startRank + i}`,
    rank: startRank + i,
    name: `Player ${startRank + i}`,
    score: Math.floor(Math.random() * 100000),
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${startRank + i}`,
    guild: i % 3 === 0 ? "Dragon Slayers" : i % 3 === 1 ? "Phoenix Rising" : "Shadow Walkers",
  }));
};

export default function VirtualListDemoPage() {
  const [items, setItems] = useState<LeaderboardItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Initial load
  useEffect(() => {
    setItems(generateData(50));
  }, []);

  const loadMore = () => {
    if (isLoading) return;
    setIsLoading(true);
    
    // Simulate network delay
    setTimeout(() => {
      setItems((prev) => [
        ...prev,
        ...generateData(50, prev.length + 1),
      ]);
      setIsLoading(false);
    }, 500);
  };

  // Render Row Item
  const renderRow = (item: LeaderboardItem, index: number) => {
    return (
      <div 
        className={cn(
          "flex items-center p-4 border-b border-slate-800 h-[70px] transition-colors",
          index % 2 === 0 ? "bg-slate-900/50" : "bg-slate-900/30",
          "hover:bg-slate-800/50"
        )}
      >
        <div className="w-12 text-center font-bold text-slate-400 text-lg italic">
          #{item.rank}
        </div>
        
        <Avatar className="h-10 w-10 mx-4 border-2 border-slate-700">
          <AvatarImage src={item.avatar} />
          <AvatarFallback>{item.name.substring(0, 2)}</AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-200 truncate">{item.name}</div>
          <div className="text-xs text-slate-500 truncate">{item.guild}</div>
        </div>
        
        <div className="text-right font-mono text-emerald-400 font-bold">
          {item.score.toLocaleString()}
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-full bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
      <header className="p-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur z-10 shadow-sm">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          Leaderboard (Virtual List)
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Loaded: {items.length.toLocaleString()} items | Performance Demo
        </p>
      </header>

      <main className="flex-1 overflow-hidden relative">
        <VirtualList
          data={items}
          renderItem={renderRow}
          estimateSize={() => 70} // Fixed height for this demo, but supports dynamic
          onEndReached={loadMore}
          className="scrollbar-hide"
          emptyComponent={
            <div className="flex flex-col items-center gap-2 text-slate-500">
                <div className="text-4xl">🏆</div>
                <p>No rankings yet</p>
            </div>
          }
        />
        
        {/* Loading Indicator Overlay */}
        {isLoading && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-800/90 text-slate-200 px-4 py-2 rounded-full text-xs shadow-xl backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
            <div className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
            Loading more...
          </div>
        )}
      </main>
    </div>
  );
}
