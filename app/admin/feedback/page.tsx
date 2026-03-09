"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { Loader2, Eye, CheckCircle, Search, Bug, ShieldAlert, XCircle } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface UnifiedFeedback {
  id: string;
  source: 'feedback' | 'report';
  user_id: string | null;
  reporter_name: string;
  content: string; // details or reason
  contact_info: string; // feedback contact or "动态举报"
  screenshot_url: string | null;
  status: string; // pending, resolved, ignored, PENDING, REVIEWED, DISMISSED
  created_at: string;

  // Report specific
  post_id?: string;
  post_content?: string;
  post_media?: string[];
}

export default function AdminFeedbackPage() {
  const [items, setItems] = useState<UnifiedFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState("all"); // 'all', 'feedback', 'report'
  const [selectedItem, setSelectedItem] = useState<UnifiedFeedback | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const supabase = createClient();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [feedbackRes, reportRes] = await Promise.all([
        supabase
          .from("feedback")
          .select(`*, profiles:user_id (nickname)`)
          .order("created_at", { ascending: false }),
        supabase
          .from("post_reports")
          .select(`*, reporter:profiles!post_reports_user_id_fkey (nickname), post:posts!post_reports_post_id_fkey (content, media_urls)`)
          .order("created_at", { ascending: false })
      ]);

      let normalizedData: UnifiedFeedback[] = [];

      if (feedbackRes.data) {
        normalizedData.push(...feedbackRes.data.map((f: any) => ({
          id: f.id,
          source: 'feedback' as const,
          user_id: f.user_id,
          reporter_name: f.profiles?.nickname || '匿名/未知',
          content: f.content,
          contact_info: f.contact_info || '',
          screenshot_url: f.screenshot_url,
          status: f.status,
          created_at: f.created_at
        })));
      }

      if (reportRes.data) {
        normalizedData.push(...reportRes.data.map((r: any) => ({
          id: r.id,
          source: 'report' as const,
          user_id: r.user_id,
          reporter_name: r.reporter?.nickname || '未知用户',
          content: r.reason,
          contact_info: '动态圈举报',
          screenshot_url: null,
          status: r.status,
          created_at: r.created_at,
          post_id: r.post_id,
          post_content: r.post?.content || '[内容已删除]',
          post_media: r.post?.media_urls || []
        })));
      }

      // Sort combined array by created_at descending
      normalizedData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setItems(normalizedData);

    } catch (err) {
      console.error(err);
      toast.error("刷新列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpdateStatus = async (id: string, source: 'feedback' | 'report', newStatus: string) => {
    try {
      const { updateFeedbackStatus } = await import('@/app/actions/admin/feedback');
      const result = await updateFeedbackStatus(id, source, newStatus);

      if (!result.success) throw new Error(result.error);

      toast.success("操作成功");
      setItems(prev => prev.map(ctx => ctx.id === id ? { ...ctx, status: newStatus } : ctx));
      if (selectedItem?.id === id) {
        setSelectedItem(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (error: any) {
      toast.error(error.message || "操作失败");
    }
  };

  const filteredList = items.filter(item => {
    // Tab filter
    if (filterTab !== 'all' && item.source !== filterTab) return false;

    // Search filter
    const query = searchQuery.toLowerCase();
    if (!query) return true;

    return item.content?.toLowerCase().includes(query) ||
      item.contact_info?.toLowerCase().includes(query) ||
      item.reporter_name.toLowerCase().includes(query) ||
      item.post_content?.toLowerCase().includes(query);
  });

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'resolved' || s === 'reviewed') {
      return <Badge className="bg-green-500 hover:bg-green-600">已处理</Badge>;
    }
    if (s === 'ignored' || s === 'dismissed') {
      return <Badge variant="secondary">已忽略</Badge>;
    }
    return <Badge className="bg-yellow-500 hover:bg-yellow-600">待处理</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">用户反馈与举报</h1>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索内容/用户/动态..."
              className="pl-8"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <Button onClick={fetchData} variant="outline" size="icon">
            <Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Tabs value={filterTab} onValueChange={setFilterTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">全部分类</TabsTrigger>
          <TabsTrigger value="feedback">普通建议</TabsTrigger>
          <TabsTrigger value="report">违规举报</TabsTrigger>
        </TabsList>

        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>类型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>提交时间</TableHead>
                <TableHead>用户</TableHead>
                <TableHead className="w-[300px]">摘要</TableHead>
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
                        <ShieldAlert className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                      <p className="font-medium">暂无相关记录</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredList.map((item) => (
                  <TableRow key={`${item.source}-${item.id}`}>
                    <TableCell>
                      {item.source === 'report' ? (
                        <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/20">举报</Badge>
                      ) : (
                        <Badge variant="outline" className="text-blue-500 border-blue-500/20 bg-blue-500/10">建议</Badge>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(item.created_at), 'yyyy-MM-dd HH:mm')}
                    </TableCell>
                    <TableCell>
                      {item.reporter_name}
                      {item.user_id && <div className="text-[10px] text-muted-foreground font-mono">{item.user_id.slice(0, 8)}</div>}
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <div className="truncate" title={item.content}>
                        {item.content}
                      </div>
                      {item.source === 'report' && (
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                          涉事: {item.post_content?.slice(0, 15)}...
                        </div>
                      )}
                      {item.screenshot_url && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-blue-500">
                          <Bug className="h-3 w-3" /> 含截图
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog open={isDialogOpen && selectedItem?.id === item.id} onOpenChange={(open) => {
                          setIsDialogOpen(open);
                          if (open) setSelectedItem(item);
                        }}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedItem(item)}>
                              <Eye className="h-4 w-4 mr-1" /> 详情
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>{item.source === 'report' ? '举报详情' : '反馈详情'}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="flex items-center justify-between border-b pb-2">
                                <div className="text-sm text-muted-foreground">
                                  {item.source === 'report' ? '举报人: ' : '提交人: '}
                                  <span className="text-foreground font-medium">{item.reporter_name}</span>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  时间: {format(new Date(item.created_at), 'yyyy-MM-dd HH:mm:ss')}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <h3 className="font-semibold text-sm text-muted-foreground">
                                  {item.source === 'report' ? '举报原因' : '问题描述'}
                                </h3>
                                <div className="p-3 bg-muted/30 rounded-lg text-sm leading-relaxed whitespace-pre-wrap">
                                  {item.content}
                                </div>
                              </div>

                              {item.source === 'feedback' && (
                                <div className="space-y-2">
                                  <h3 className="font-semibold text-sm text-muted-foreground">联系方式</h3>
                                  <div className="text-sm">{item.contact_info}</div>
                                </div>
                              )}

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

                              {item.source === 'report' && (
                                <div className="space-y-2 mt-4 pt-4 border-t">
                                  <h3 className="font-semibold text-sm text-red-500/80 flex items-center">
                                    <ShieldAlert className="w-4 h-4 mr-1" /> 涉事动态内容
                                  </h3>
                                  <div className="p-3 border border-red-500/20 bg-red-500/5 rounded-lg text-sm leading-relaxed whitespace-pre-wrap">
                                    {item.post_content}
                                  </div>
                                  {item.post_media && item.post_media.length > 0 && (
                                    <div className="mt-2 grid grid-cols-3 gap-2">
                                      {item.post_media.map((url, i) => (
                                        <div key={i} className="aspect-square border rounded bg-black/5">
                                          <img src={url} className="w-full h-full object-cover" />
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <div className="text-xs text-muted-foreground mt-1">动态ID: {item.post_id}</div>
                                </div>
                              )}

                              <div className="flex justify-end pt-4 border-t gap-2 flex-wrap">
                                {item.source === 'feedback' && item.status !== 'resolved' && (
                                  <Button onClick={() => handleUpdateStatus(item.id, 'feedback', 'resolved')} className="bg-green-600 hover:bg-green-700">
                                    <CheckCircle className="h-4 w-4 mr-2" /> 标记已处理
                                  </Button>
                                )}

                                {item.source === 'report' && item.status === 'PENDING' && (
                                  <>
                                    <Button onClick={() => handleUpdateStatus(item.id, 'report', 'REVIEWED')} className="bg-green-600 hover:bg-green-700">
                                      <CheckCircle className="h-4 w-4 mr-2" /> 确认违规
                                    </Button>
                                    <Button onClick={() => handleUpdateStatus(item.id, 'report', 'DISMISSED')} variant="outline" className="text-muted-foreground">
                                      <XCircle className="h-4 w-4 mr-2" /> 驳回误报
                                    </Button>
                                  </>
                                )}

                                <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>关闭</Button>
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
      </Tabs>
    </div>
  );
}
