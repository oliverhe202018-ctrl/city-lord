"use client"

import React, { useState, useEffect } from 'react';
import { Users, MapPin, Search, Plus, Filter, ArrowUpDown, Loader2, CheckCircle2, Camera, ChevronRight, Upload } from 'lucide-react';
import { toast } from 'sonner';

const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit, timeoutMs = 15000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const getAvailableProvinces = async (): Promise<string[]> => {
  const res = await fetchWithTimeout('/api/club/get-available-provinces', { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch provinces')
  return await res.json()
}

import { useGameStore } from '@/store/useGameStore';
import { createClient } from "@/lib/supabase/client";
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { AvatarUploader } from '@/components/ui/AvatarUploader';

import { CreateClubDrawer } from './CreateClubDrawer';

interface ClubDiscoveryViewProps {
  clubs: any[];
  onJoinSuccess: () => void;
  isLoading?: boolean;
  onOpenCreate: () => void;
  onViewClub: (clubId: string) => void;
}

export function ClubDiscoveryView({ 
  clubs, 
  onJoinSuccess, 
  isLoading = false,
  onOpenCreate,
  onViewClub
}: ClubDiscoveryViewProps) {
  // Only keep states needed for List View
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter State
  const [provinces, setProvinces] = useState<string[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<string>('all');
  
  useEffect(() => {
      getAvailableProvinces().then(data => {
          setProvinces(data);
      });
  }, []);

  const filteredClubs = clubs.filter(club => {
    const matchesSearch = club.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProvince = selectedProvince === 'all' || club.province === selectedProvince;
    return matchesSearch && matchesProvince;
  });

  // View: List (Default)
  return (
    <div className="flex flex-col h-auto max-h-[85vh]">
      <div className="px-6 pb-4 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索俱乐部..."
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary/50 transition-all"
          />
        </div>

        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={onOpenCreate}
            className="flex-1 py-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            创建俱乐部
          </button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all flex items-center gap-2 ${selectedProvince !== 'all' ? 'bg-primary border-primary text-primary-foreground' : 'bg-muted/50 border-border text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                    <Filter className="w-4 h-4" />
                    {selectedProvince === 'all' ? '筛选' : selectedProvince}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-popover border-border text-popover-foreground z-[9999]" align="end">
                <DropdownMenuLabel>按省份筛选</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuRadioGroup value={selectedProvince} onValueChange={setSelectedProvince}>
                    <DropdownMenuRadioItem value="all">全部省份</DropdownMenuRadioItem>
                    {provinces.map(p => (
                        <DropdownMenuRadioItem key={p} value={p}>{p}</DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <button className="px-4 py-2.5 rounded-xl bg-muted/50 border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex items-center gap-2 text-sm">
             <ArrowUpDown className="w-4 h-4" />
             排序
          </button>
        </div>
      </div>

      <div className="px-6 py-2 space-y-3 overflow-y-auto flex-1 min-h-0 pb-safe">
        {isLoading ? (
            <div className="flex justify-center py-10">
                <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
            </div>
        ) : filteredClubs.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
                暂无符合条件的俱乐部
            </div>
        ) : (
            filteredClubs.map((club) => (
            <div
                key={club.id}
                onClick={() => onViewClub(club.id)}
                className="w-full p-4 rounded-2xl bg-muted/30 border border-border hover:bg-muted/50 transition-all cursor-pointer"
            >
                <div className="flex items-center gap-4">
                <div className="relative flex-shrink-0">
                    <img
                    src={club.avatar}
                    alt={club.name}
                    className="w-14 h-14 rounded-xl object-cover bg-muted"
                    />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                    <h3 className="text-foreground font-bold text-base truncate">{club.name}</h3>
                    <div className="flex flex-col items-end">
                        <span className="text-lg font-bold text-foreground">{club.members.toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground">成员</span>
                    </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <span>{club.territory || '0 mi²'}</span>
                            {club.province && (
                                <>
                                    <span className="mx-1">•</span>
                                    <span>{club.province}</span>
                                </>
                            )}
                        </div>
                        
                        <Button
                            size="sm"
                            variant={club.isJoined ? "secondary" : "outline"}
                            onClick={(e) => {
                                e.stopPropagation();
                                onViewClub(club.id);
                            }}
                            className={`h-7 text-xs px-3 ${
                                !club.isJoined ? "border-primary/50 text-primary hover:bg-primary/10" : ""
                            }`}
                        >
                            {club.isJoined ? '已申请' : '详情'}
                        </Button>
                    </div>
                </div>
                </div>
            </div>
            ))
        )}
      </div>
    </div>
  );
}