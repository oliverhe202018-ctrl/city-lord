"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { Loader2, Eye, CheckCircle, Search, Bug } from "lucide-react";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface Feedback {
  id: string;
  user_id: string | null;
  content: string;
  contact_info: string;
  screenshot_url: string | null;
  status: 'pending' | 'resolved' | 'ignored';
  created_at: string;
  profiles?: {
    nickname: string;
  } | null;
}

export default function AdminFeedbackPage() {
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const supabase = createClient();

  const fetchFeedback = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("feedback")
        .select(`
          *,
          profiles:user_id (nickname)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        // If 404/Empty, it might just mean no table or empty, handle gracefully
        if (error.code === 'PGRST116' || error.message.includes('not found')) {
            setFeedbackList([])
        } else {
            console.error("Fetch error:", error);
            // Don't toast error on init load if it's just empty
            if (feedbackList.length > 0) toast.error("刷新列表失败");
        }
      } else {
        setFeedbackList(data as any || []);
      }
    } catch (err) {
      console.error(err);
      setFeedbackList([]); // Fallback to empty state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, []);

  const handleResolve = async (id: string) => {
    try {
      const { error } = await supabase
        .from("feedback")
        .update({ status: 'resolved' })
        .eq('id', id);

      if (error) throw error;

      toast.success("已标记为处理");
      // Update local state
      setFeedbackList(prev => 
        prev.map(item => item.id === id ? { ...item, status: 'resolved' } : item)
      );
      if (selectedFeedback?.id === id) {
        setSelectedFeedback(prev => prev ? { ...prev, status: 'resolved' } : null);
      }
    } catch (error) {
      toast.error("操作失败");
    }
  };

  const filteredList = feedbackList.filter(item => 
    item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.contact_info.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.profiles?.nickname?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return <Badge className="bg-green-500 hover:bg-green-600">已解决</Badge>;
      case 'ignored':
        return <Badge variant="secondary">已忽略</Badge>;
      default:
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">待处理</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">用户反馈</h1>
        <div className="flex items-center gap-2">
           <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="搜索内容/联系方式/用户..." 
                className="pl-8"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
           </div>
           <Button onClick={fetchFeedback} variant="outline" size="icon">
             <Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
           </Button>
        </div>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>状态</TableHead>
              <TableHead>提交时间</TableHead>
              <TableHead>用户</TableHead>
              <TableHead className="w-[300px]">问题摘要</TableHead>
              <TableHead>联系方式</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-64 text-center">
                   <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <div className="bg-muted rounded-full p-4 mb-3">
                         <Bug className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                      <p className="font-medium">暂无反馈记录</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">用户提交的反馈将会显示在这里</p>
                   </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredList.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(item.created_at), 'yyyy-MM-dd HH:mm')}
                  </TableCell>
                  <TableCell>
                    {item.profiles?.nickname || <span className="text-muted-foreground italic">匿名/未知</span>}
                    {item.user_id && <div className="text-[10px] text-muted-foreground font-mono">{item.user_id.slice(0, 8)}</div>}
                  </TableCell>
                  <TableCell className="max-w-[300px]">
                    <div className="truncate" title={item.content}>
                      {item.content}
                    </div>
                    {item.screenshot_url && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-blue-500">
                        <Bug className="h-3 w-3" /> 含截图
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{item.contact_info}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Dialog open={isDialogOpen && selectedFeedback?.id === item.id} onOpenChange={(open) => {
                          setIsDialogOpen(open);
                          if(open) setSelectedFeedback(item);
                      }}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => setSelectedFeedback(item)}>
                            <Eye className="h-4 w-4 mr-1" /> 详情
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>反馈详情</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="flex items-center justify-between border-b pb-2">
                                <div className="text-sm text-muted-foreground">
                                    提交人: <span className="text-foreground font-medium">{item.profiles?.nickname || 'Unknown'}</span>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    时间: {format(new Date(item.created_at), 'yyyy-MM-dd HH:mm:ss')}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="font-semibold text-sm text-muted-foreground">问题描述</h3>
                                <div className="p-3 bg-muted/30 rounded-lg text-sm leading-relaxed whitespace-pre-wrap">
                                    {item.content}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="font-semibold text-sm text-muted-foreground">联系方式</h3>
                                <div className="text-sm">{item.contact_info}</div>
                            </div>

                            {item.screenshot_url && (
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-sm text-muted-foreground">问题截图</h3>
                                    <div className="border rounded-lg overflow-hidden bg-black/5">
                                        <img src={item.screenshot_url} alt="Screenshot" className="w-full object-contain max-h-[500px]" />
                                    </div>
                                    <a href={item.screenshot_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline block text-right">
                                        查看原图
                                    </a>
                                </div>
                            )}

                            <div className="flex justify-end pt-4 border-t gap-2">
                                {item.status !== 'resolved' && (
                                    <Button onClick={() => handleResolve(item.id)} className="bg-green-600 hover:bg-green-700">
                                        <CheckCircle className="h-4 w-4 mr-2" /> 标记已处理
                                    </Button>
                                )}
                                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>关闭</Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
