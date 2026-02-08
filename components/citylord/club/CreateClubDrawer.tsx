import React, { useState } from 'react';
import { X, Loader2, Upload } from 'lucide-react';
import { createClub } from '@/app/actions/club';
import { toast } from 'sonner';
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
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from '@/components/ui/drawer';

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
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()} snapPoints={[0.95]}>
      <DrawerContent className="h-[96vh] p-0 border-none bg-transparent">
        {/* 1. 外层容器：全高，Flex 列布局 */}
        <div className="flex flex-col h-full w-full bg-zinc-900 rounded-t-[32px] overflow-hidden">
          
          {/* 2. 头部 (Fixed): 禁止压缩，禁止滚动 */}
          <div className="flex-none p-4 border-b border-white/10 relative">
            {/* Handle bar for visual cue */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/20 rounded-full" />
            
            <div className="mt-4 flex items-center justify-between px-2">
              <h2 className="text-xl font-bold text-white">创建俱乐部</h2>
              <DrawerClose className="p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
                <X className="w-6 h-6 text-white/60" />
              </DrawerClose>
            </div>
          </div>

          {/* 3. 中间内容 (Scrollable): 占据剩余空间，仅此处滚动 */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 overscroll-contain custom-scrollbar">
             {/* Avatar Upload */}
             <div className="flex flex-col items-center justify-center">
              <AvatarUploader
                currentAvatarUrl={formData.avatarUrl}
                onUploadComplete={(url) => setFormData({ ...formData, avatarUrl: url })}
                size={96}
                cropShape="rect"
              />
              <p className="text-xs text-zinc-500 mt-3">上传俱乐部 Logo</p>
            </div>

            {/* Club Name */}
            <div className="space-y-2">
              <Label className="text-zinc-400 text-xs uppercase tracking-wider font-semibold">俱乐部名称</Label>
              <div className="bg-zinc-900 rounded-xl p-1 border border-zinc-800 focus-within:border-white/20 transition-all">
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-transparent text-white placeholder-zinc-600 focus:outline-none text-base"
                  placeholder="给你的俱乐部起个名字"
                />
              </div>
            </div>

            {/* Province Selection */}
            <div className="space-y-2">
              <Label className="text-zinc-400 text-xs uppercase tracking-wider font-semibold">所在省份</Label>
              <Select 
                value={formData.province} 
                onValueChange={(val) => setFormData({ ...formData, province: val })}
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
              <Label className="text-zinc-400 text-xs uppercase tracking-wider font-semibold">俱乐部简介</Label>
              <div className="bg-zinc-900 rounded-xl p-1 border border-zinc-800 focus-within:border-white/20 transition-all">
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-transparent text-white placeholder-zinc-600 focus:outline-none text-base min-h-[120px] resize-none"
                  placeholder="介绍一下你的俱乐部..."
                />
              </div>
            </div>

            {/* Visibility Toggle */}
            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-white font-medium text-base">
                  {formData.isPublic ? '公开加入' : '私密邀请'}
                </Label>
                <p className="text-xs text-zinc-500">
                  {formData.isPublic ? '允许任何人搜索并加入' : '仅允许邀请加入'}
                </p>
              </div>
              <Switch 
                checked={formData.isPublic}
                onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked })}
                className="data-[state=checked]:bg-white data-[state=unchecked]:bg-zinc-700"
              />
            </div>
            
            {/* Bottom Padding to prevent content from hitting the edge */}
            <div className="pb-6" />
          </div>

          {/* 4. 底部 (Fixed): 禁止压缩，固定在最下方 */}
          <div className="flex-none p-4 border-t border-white/10 bg-zinc-900 safe-area-bottom">
            <Button
              onClick={handleSubmit}
              className="w-full h-12 rounded-xl bg-white text-black font-bold text-lg hover:bg-white/90 active:scale-95 transition-all shadow-lg shadow-white/5"
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
