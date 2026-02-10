import React, { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Calendar, Trash2, Edit2, Play, Loader2 } from "lucide-react";
import { format } from 'date-fns';
import { useToast } from "@/hooks/use-toast";

export interface Route {
  id: string;
  name: string;
  distance: number;
  capture_area: number;
  created_at: string;
  waypoints: any[];
}

interface MyRoutesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (route: Route) => void;
  onDelete: (id: string) => void;
  onStartRun: (route: Route) => void;
  trigger?: React.ReactNode;
}

export function MyRoutesSheet({
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onStartRun,
  trigger
}: MyRoutesSheetProps) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchRoutes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/routes/route');
      if (!res.ok) throw new Error('加载路线失败');
      const data = await res.json();
      setRoutes(data);
    } catch (error) {
      console.error(error);
      toast({
        title: "错误",
        description: "加载路线失败",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchRoutes();
    }
  }, [open]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定要删除这条路线吗？')) return;
    
    try {
      const res = await fetch(`/api/routes/route?id=${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('删除失败');
      setRoutes(routes.filter(r => r.id !== id));
      onDelete(id);
      toast({
        title: "成功",
        description: "路线已删除",
      });
    } catch (error) {
      toast({
        title: "错误",
        description: "删除路线失败",
        variant: "destructive",
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent side="right" className="w-full sm:max-w-md bg-black/95 border-l border-white/10 text-white z-[150] p-0">
        <div className="flex flex-col h-full">
            <div className="p-6 border-b border-white/10">
                <SheetHeader>
                <SheetTitle className="text-2xl font-bold text-white">我的路线</SheetTitle>
                <SheetDescription className="text-white/50">
                    管理你保存的路线与领地。
                </SheetDescription>
                </SheetHeader>
            </div>

            <ScrollArea className="flex-1 p-6">
            {loading ? (
                <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
                </div>
            ) : routes.length === 0 ? (
                <div className="text-center py-20 text-white/50">
                <MapPin className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>暂无保存的路线。</p>
                </div>
            ) : (
                <div className="space-y-4">
                {routes.map((route) => (
                    <div
                    key={route.id}
                    className="group relative bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl overflow-hidden transition-all"
                    >
                    <div className="p-4">
                        <div className="flex justify-between items-start mb-2">
                        <div>
                            <h3 className="font-bold text-lg text-white group-hover:text-cyan-400 transition-colors">
                            {route.name || '未命名路线'}
                            </h3>
                            <div className="flex items-center text-xs text-white/50 mt-1">
                            <Calendar className="h-3 w-3 mr-1" />
                            {format(new Date(route.created_at), 'yyyy年M月d日')}
                            </div>
                        </div>
                        <div className="bg-cyan-500/20 text-cyan-400 text-xs font-bold px-2 py-1 rounded">
                            {route.distance?.toFixed(2)} km
                        </div>
                        </div>

                        <div className="flex items-center justify-between mt-4">
                        <div className="text-sm text-purple-400 font-medium">
                            领地面积：{route.capture_area?.toFixed(2) || 0} km²
                        </div>
                        </div>
                    </div>

                    <div className="bg-black/40 p-2 flex gap-2 border-t border-white/5">
                        <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 h-8 text-xs bg-white/5 hover:bg-green-500/20 hover:text-green-400"
                        onClick={() => onStartRun(route)}
                        >
                        <Play className="h-3 w-3 mr-1.5" />
                        开始跑步
                        </Button>
                        <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 h-8 text-xs bg-white/5 hover:bg-cyan-500/20 hover:text-cyan-400"
                        onClick={() => onEdit(route)}
                        >
                        <Edit2 className="h-3 w-3 mr-1.5" />
                        编辑
                        </Button>
                        <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-white/30 hover:text-red-400 hover:bg-red-500/20"
                        onClick={(e) => handleDelete(route.id, e)}
                        >
                        <Trash2 className="h-3 w-3" />
                        </Button>
                    </div>
                    </div>
                ))}
                </div>
            )}
            </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
