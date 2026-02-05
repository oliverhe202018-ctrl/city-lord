"use client"

import React, { useState, useEffect } from 'react';
import { Users, MapPin, Search, Plus, Filter, ArrowUpDown, Loader2, CheckCircle2, Camera, ChevronRight, Upload } from 'lucide-react';
import { createClub, joinClub, getAvailableProvinces } from '@/app/actions/club';
import { toast } from 'sonner';
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

// Simplified list of major Chinese provinces/regions for the dropdown
const CHINA_PROVINCES = [
  "北京市", "天津市", "河北省", "山西省", "内蒙古自治区",
  "辽宁省", "吉林省", "黑龙江省", "上海市", "江苏省",
  "浙江省", "安徽省", "福建省", "江西省", "山东省",
  "河南省", "湖北省", "湖南省", "广东省", "广西壮族自治区",
  "海南省", "重庆市", "四川省", "贵州省", "云南省",
  "西藏自治区", "陕西省", "甘肃省", "青海省", "宁夏回族自治区",
  "新疆维吾尔自治区", "香港特别行政区", "澳门特别行政区", "台湾省"
];

interface ClubDiscoveryViewProps {
  clubs: any[];
  onJoinSuccess: () => void;
  isLoading?: boolean;
}

export function ClubDiscoveryView({ clubs, onJoinSuccess, isLoading = false }: ClubDiscoveryViewProps) {
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    province: '',
    isPublic: true,
    avatarUrl: ''
  });
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [joiningClubId, setJoiningClubId] = useState<string | null>(null);
  
  // Filter State
  const [provinces, setProvinces] = useState<string[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<string>('all');
  
  // Join Confirmation State (Replaces Dialog)
  const [selectedClub, setSelectedClub] = useState<{id: string, name: string, avatar: string} | null>(null);

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

  const handleCreateClub = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!createForm.name.trim()) {
      toast.error('请输入俱乐部名称');
      return;
    }
    
    if (!createForm.province) {
        toast.error('请选择所在省份');
        return;
    }

    setIsCreating(true);

    try {
      // Use uploaded avatar URL or fallback to dicebear
      const avatarUrl = createForm.avatarUrl || `https://api.dicebear.com/7.x/shapes/svg?seed=${createForm.name}`;
      
      const result = await createClub({
        name: createForm.name,
        description: createForm.description,
        avatar_url: avatarUrl,
        province: createForm.province,
        is_public: createForm.isPublic
      });

      if (!result.success || !result.data) {
        toast.error('创建失败', {
          description: result.error || '请稍后重试'
        });
        return;
      }

      toast.success('申请已提交！');
      setIsSubmitted(true);
      
    } catch (error) {
      toast.error('创建失败', {
        description: error instanceof Error ? error.message : '请稍后重试'
      });
    } finally {
        setIsCreating(false);
    }
  };

  const onJoinClick = (club: any) => {
      setSelectedClub({
          id: club.id,
          name: club.name,
          avatar: club.avatar
      });
  }

  const confirmJoin = async () => {
    if (!selectedClub) return;
    
    setJoiningClubId(selectedClub.id);
    
    try {
        const result = await joinClub(selectedClub.id);
        if (result.success) {
            if (result.status === 'active') {
                toast.success(`加入 ${selectedClub.name} 成功！`);
            } else {
                toast.success('申请已提交，等待审核');
            }
            setSelectedClub(null);
            onJoinSuccess();
        } else {
            toast.error(result.error || '加入失败');
        }
    } catch (e) {
        toast.error('请求失败');
    } finally {
        setJoiningClubId(null);
    }
  };

  // View: Create
  if (viewMode === 'create') {
    if (isSubmitted) {
        return (
            <div className="flex flex-col h-full bg-zinc-950 text-white items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-300">
                <div className="mb-8 relative">
                    <div className="w-24 h-24 rounded-full bg-green-500/10 flex items-center justify-center animate-pulse">
                        <CheckCircle2 className="w-12 h-12 text-green-500" />
                    </div>
                    <div className="absolute inset-0 rounded-full border border-green-500/20 scale-125" />
                </div>
                
                <h1 className="text-2xl font-black text-white uppercase tracking-wide mb-2">申请已提交</h1>
                <p className="text-zinc-500 text-sm max-w-[280px] mx-auto leading-relaxed mb-12">
                    我们会仔细审核您的申请以确保信息无误。一旦您的俱乐部获批，您将收到通知。
                </p>

                <div className="w-full max-w-xs space-y-2 mb-12">
                    <h2 className="text-lg font-bold text-white">管理我的俱乐部</h2>
                    <p className="text-zinc-500 text-xs">
                        审核通过后，您可以在俱乐部设置菜单中编辑您的俱乐部详情。
                    </p>
                </div>

                <Button 
                    onClick={() => {
                        setIsSubmitted(false);
                        setViewMode('list');
                        onJoinSuccess();
                    }}
                    className="w-full max-w-xs h-14 rounded-xl bg-white text-black font-bold text-lg hover:bg-white/90 active:scale-95 transition-all"
                >
                    知道了
                </Button>
            </div>
        )
    }

    return (
      <div className="flex flex-col h-full bg-zinc-950 text-white overflow-y-auto">
        {/* Header */}
        <div className="flex items-center px-6 py-6 sticky top-0 bg-zinc-950 z-10">
            <button 
                onClick={() => setViewMode('list')}
                className="mr-4 text-white/50 hover:text-white transition-colors"
            >
                ← 返回
            </button>
            <h2 className="text-xl font-bold text-white">创建新俱乐部</h2>
        </div>
        
        <div className="px-6 pb-20 space-y-8">
            {/* Avatar Upload */}
            <div className="flex flex-col items-center justify-center">
                <AvatarUploader
                  currentAvatarUrl={createForm.avatarUrl}
                  onUploadComplete={(url) => setCreateForm({ ...createForm, avatarUrl: url })}
                  size={96} // w-24 = 96px
                  cropShape="rect"
                />
                <p className="text-xs text-zinc-500 mt-3">上传俱乐部 Logo (自动裁剪为 1:1)</p>
            </div>

            {/* Form Fields */}
            <div className="space-y-6">
                {/* Name */}
                <div className="space-y-2">
                    <Label className="text-zinc-400 text-xs uppercase tracking-wider font-semibold">俱乐部名称</Label>
                    <div className="bg-zinc-900 rounded-xl p-1 border border-zinc-800 focus-within:border-white/20 transition-all">
                        <input
                            type="text"
                            value={createForm.name}
                            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                            className="w-full px-4 py-3 bg-transparent text-white placeholder-zinc-600 focus:outline-none text-base"
                            placeholder="给你的俱乐部起个名字"
                        />
                    </div>
                </div>

                {/* Province Select */}
                <div className="space-y-2">
                    <Label className="text-zinc-400 text-xs uppercase tracking-wider font-semibold">所在省份</Label>
                    <Select 
                        value={createForm.province} 
                        onValueChange={(val) => setCreateForm({ ...createForm, province: val })}
                    >
                        <SelectTrigger className="w-full h-14 bg-zinc-900 border-zinc-800 text-white rounded-xl px-4 focus:ring-0 focus:ring-offset-0">
                            <SelectValue placeholder="选择省份" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800 text-white max-h-[300px] z-[9999]">
                            {CHINA_PROVINCES.map((p) => (
                                <SelectItem key={p} value={p} className="focus:bg-zinc-800 focus:text-white cursor-pointer">
                                    {p}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Description */}
                <div className="space-y-2">
                    <Label className="text-zinc-400 text-xs uppercase tracking-wider font-semibold">描述 (选填)</Label>
                    <div className="bg-zinc-900 rounded-xl p-1 border border-zinc-800 focus-within:border-white/20 transition-all">
                        <textarea
                            value={createForm.description}
                            onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                            className="w-full px-4 py-3 bg-transparent text-white placeholder-zinc-600 focus:outline-none text-base min-h-[100px] resize-none"
                            placeholder="介绍一下你的俱乐部..."
                        />
                    </div>
                </div>

                {/* Visibility Toggle */}
                <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label className="text-white font-medium text-base">
                            {createForm.isPublic ? '公开加入' : '私密邀请'}
                        </Label>
                        <p className="text-xs text-zinc-500">
                            {createForm.isPublic ? '允许任何人搜索并加入俱乐部' : '仅允许邀请加入俱乐部'}
                        </p>
                    </div>
                    <Switch 
                        checked={createForm.isPublic}
                        onCheckedChange={(checked) => setCreateForm({ ...createForm, isPublic: checked })}
                        className="data-[state=checked]:bg-white data-[state=unchecked]:bg-zinc-700"
                    />
                </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
                <Button
                    onClick={handleCreateClub}
                    className="w-full h-14 rounded-xl bg-white text-black font-bold text-lg hover:bg-white/90 active:scale-95 transition-all shadow-lg shadow-white/5"
                    disabled={isCreating}
                >
                    {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : '立即创建'}
                </Button>
            </div>
        </div>
      </div>
    );
  }

  // View: Confirmation (Full Screen replacement)
  if (selectedClub) {
      return (
        <div className="flex flex-col h-full items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-1 bg-zinc-800 rounded-full mb-8 opacity-50" />
            
            <h2 className="text-xl font-bold text-white mb-2">加入俱乐部</h2>
            <p className="text-zinc-400 mb-8 text-sm">确认要加入这个俱乐部吗？</p>

            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-zinc-800 mb-4 shadow-xl">
                <img src={selectedClub.avatar} alt={selectedClub.name} className="w-full h-full object-cover" />
            </div>
            
            <h3 className="text-2xl font-black text-white mb-12">{selectedClub.name}</h3>

            <div className="flex gap-4 w-full">
                <Button 
                    variant="outline" 
                    onClick={() => setSelectedClub(null)}
                    className="flex-1 py-6 rounded-xl bg-transparent border-zinc-700 text-white hover:bg-zinc-800 hover:text-white"
                >
                    取消
                </Button>
                <Button 
                    onClick={confirmJoin}
                    className="flex-1 py-6 rounded-xl bg-white text-black font-bold hover:bg-white/90"
                    disabled={!!joiningClubId}
                >
                    {joiningClubId ? <Loader2 className="w-4 h-4 animate-spin" /> : '确认加入'}
                </Button>
            </div>
        </div>
      );
  }

  // View: List (Default)
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索俱乐部..."
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-zinc-800/50 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/20 transition-all"
          />
        </div>

        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={() => setViewMode('create')}
            className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            创建俱乐部
          </button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all flex items-center gap-2 ${selectedProvince !== 'all' ? 'bg-zinc-800 border-white/30 text-white' : 'bg-zinc-800/50 border-white/10 text-white/70 hover:text-white hover:bg-zinc-800'}`}>
                    <Filter className="w-4 h-4" />
                    {selectedProvince === 'all' ? '筛选' : selectedProvince}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-zinc-900 border-zinc-800 text-white z-[9999]" align="end">
                <DropdownMenuLabel>按省份筛选</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-zinc-800" />
                <DropdownMenuRadioGroup value={selectedProvince} onValueChange={setSelectedProvince}>
                    <DropdownMenuRadioItem value="all">全部省份</DropdownMenuRadioItem>
                    {provinces.map(p => (
                        <DropdownMenuRadioItem key={p} value={p}>{p}</DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <button className="px-4 py-2.5 rounded-xl bg-zinc-800/50 border border-white/10 text-white/70 hover:text-white hover:bg-zinc-800 transition-all flex items-center gap-2 text-sm">
             <ArrowUpDown className="w-4 h-4" />
             排序
          </button>
        </div>
      </div>

      <div className="px-6 py-2 space-y-3 overflow-y-auto flex-1 pb-20 no-scrollbar">
        {isLoading ? (
            <div className="flex justify-center py-10">
                <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
            </div>
        ) : filteredClubs.length === 0 ? (
            <div className="text-center py-10 text-white/30">
                暂无符合条件的俱乐部
            </div>
        ) : (
            filteredClubs.map((club) => (
            <div
                key={club.id}
                onClick={() => onJoinClick(club)}
                className="w-full p-4 rounded-2xl bg-zinc-800/30 border border-white/5 hover:bg-zinc-800/50 transition-all cursor-pointer"
            >
                <div className="flex items-center gap-4">
                <div className="relative flex-shrink-0">
                    <img
                    src={club.avatar}
                    alt={club.name}
                    className="w-14 h-14 rounded-xl object-cover"
                    />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                    <h3 className="text-white font-bold text-base truncate">{club.name}</h3>
                    <div className="flex flex-col items-end">
                        <span className="text-lg font-bold text-white">{club.members.toLocaleString()}</span>
                        <span className="text-xs text-white/40">成员</span>
                    </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1 text-xs text-white/50">
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
                                onJoinClick(club);
                            }}
                            disabled={club.isJoined || joiningClubId === club.id}
                            className={`h-7 text-xs px-3 ${
                                !club.isJoined ? "border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10" : ""
                            }`}
                        >
                            {club.isJoined ? '已申请' : (joiningClubId === club.id ? '...' : '加入')}
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