"use client"

import React, { useState } from 'react';
import { X, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit, timeoutMs = 15000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let url = input
    if (typeof url === 'string' && url.startsWith('/api')) {
      url = `${process.env.NEXT_PUBLIC_API_SERVER || ''}${url}`
    }
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const createClub = async (payload: { name: string; description?: string; avatar_url?: string; province?: string; is_public?: boolean }) => {
  const res = await fetchWithTimeout('/api/club/create-club', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to create club')
  return await res.json()
}

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AvatarUploader } from '@/components/ui/AvatarUploader';
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerClose 
} from '@/components/ui/drawer';

// List of major Chinese provinces/regions
const CHINA_PROVINCES = [
  "北京市", "天津市", "河北省", "山西省", "内蒙古自治区",
  "辽宁省", "吉林省", "黑龙江省", "上海市", "江苏省",
  "浙江省", "安徽省", "福建省", "江西省", "山东省",
  "河南省", "湖北省", "湖南省", "广东省", "广西壮族自治区",
  "海南省", "重庆市", "四川省", "贵州省", "云南省",
  "西藏自治区", "陕西省", "甘肃省", "青海省", "宁夏回族自治区",
  "新疆维吾尔自治区", "香港特别行政区", "澳门特别行政区", "台湾省"
];

interface CreateClubDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateClubDrawer({ isOpen, onClose, onSuccess }: CreateClubDrawerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [snapPoint, setSnapPoint] = useState<number | string | null>(1);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    province: '',
    isPublic: true,
    avatarUrl: ''
  });

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('请输入俱乐部名称');
      return;
    }
    
    if (!formData.province) {
      toast.error('请选择所在省份');
      return;
    }

    setIsLoading(true);

    try {
      // Use uploaded avatar URL or fallback to dicebear
      const avatarUrl = formData.avatarUrl || `https://api.dicebear.com/7.x/shapes/svg?seed=${formData.name}`;
      
      const result = await createClub({
        name: formData.name,
        description: formData.description,
        avatar_url: avatarUrl,
        province: formData.province,
        is_public: formData.isPublic
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || '创建失败');
      }

      toast.success('申请已提交！');
      onSuccess?.();
      onClose();
      
    } catch (error) {
      toast.error('创建失败', {
        description: error instanceof Error ? error.message : '请稍后重试'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Drawer 
      open={isOpen} 
      onOpenChange={(open) => !open && onClose()}
      snapPoints={[0.4, 1]}
      activeSnapPoint={snapPoint}
      onActiveSnapPointChange={setSnapPoint}
      dismissible={true}
      repositionInputs={false}
    >
      <DrawerContent className="max-h-[96vh] p-0 border-none bg-transparent">
        {/* 1. 全局容器: 确保头部底部固定 */}
        <div className="flex flex-col h-full w-full bg-background rounded-t-[10px] overflow-hidden">
          
          {/* 2. 头部 (Fixed) - 放置 DrawerTitle 消除报错 */}
          <DrawerHeader className="flex-none border-b border-border px-4 py-4">
            <div className="flex items-center justify-between">
              {/* 👇 关键点：使用 DrawerTitle 替换普通的 h2/div */}
              <DrawerTitle className="text-lg font-bold text-foreground">
                创建俱乐部
              </DrawerTitle>
              
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground">
                  <X className="w-5 h-5" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          {/* 3. 中间内容 (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6 overscroll-contain custom-scrollbar">
             {/* Avatar Upload */}
             <div className="flex flex-col items-center justify-center">
              <AvatarUploader
                currentAvatarUrl={formData.avatarUrl}
                onUploadComplete={(url) => setFormData({ ...formData, avatarUrl: url })}
                size={96}
                cropShape="rect"
                cropAspect={1}
              />
              <p className="text-xs text-muted-foreground mt-3">上传俱乐部 Logo (必须为正方形)</p>
            </div>

            {/* Club Name */}
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">俱乐部名称</Label>
              <div className="bg-muted/50 rounded-xl p-1 border border-border focus-within:border-primary/50 transition-all">
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-base"
                  placeholder="给你的俱乐部起个名字"
                />
              </div>
            </div>

            {/* Province Selection */}
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">所在省份</Label>
              <Select 
                value={formData.province} 
                onValueChange={(val) => setFormData({ ...formData, province: val })}
              >
                <SelectTrigger className="w-full h-14 bg-muted/50 border-border text-foreground rounded-xl px-4 focus:ring-0 focus:ring-offset-0">
                  <SelectValue placeholder="选择省份" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground max-h-[300px] z-[9999]">
                  {CHINA_PROVINCES.map((p) => (
                    <SelectItem key={p} value={p} className="focus:bg-muted focus:text-foreground cursor-pointer">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">俱乐部简介</Label>
              <div className="bg-muted/50 rounded-xl p-1 border border-border focus-within:border-primary/50 transition-all">
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-base min-h-[120px] resize-none"
                  placeholder="介绍一下你的俱乐部..."
                />
              </div>
            </div>

            {/* Visibility Toggle */}
            <div className="bg-muted/50 rounded-xl p-4 border border-border flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-foreground font-medium text-base">
                  {formData.isPublic ? '公开加入' : '私密邀请'}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {formData.isPublic ? '允许任何人搜索并加入' : '仅允许邀请加入'}
                </p>
              </div>
              <Switch 
                checked={formData.isPublic}
                onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked })}
                className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-input"
              />
            </div>
          </div>

          {/* 4. 底部 (Fixed) */}
          <div className="flex-none p-4 border-t border-border bg-background safe-area-bottom">
            <Button
              onClick={handleSubmit}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold text-lg hover:bg-primary/90 active:scale-95 transition-all shadow-lg"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '立即创建'}
            </Button>
          </div>

        </div>
      </DrawerContent>
    </Drawer>
  );
}
