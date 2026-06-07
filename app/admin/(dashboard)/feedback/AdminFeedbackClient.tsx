"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { Eye, CheckCircle, Search, Bug, ShieldAlert, XCircle } from "lucide-react";
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
import type { UnifiedFeedback } from "@/app/actions/admin/get-feedback";
import { updateFeedbackStatus } from "@/app/actions/admin/feedback";

export function AdminFeedbackClient({ initialItems }: { initialItems: UnifiedFeedback[] }) {
    const [items, setItems] = useState<UnifiedFeedback[]>(initialItems);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterTab, setFilterTab] = useState("all");
    const [selectedItem, setSelectedItem] = useState<UnifiedFeedback | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const handleUpdateStatus = async (id: string, source: "feedback" | "report" | "territory_report", newStatus: string) => {
        try {
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
        if (filterTab !== 'all' && item.source !== filterTab) return false;

        const query = searchQuery.toLowerCase();
        if (!query) return true;

        return item.content?.toLowerCase().includes(query) ||
            item.contact_info?.toLowerCase().includes(query) ||
            item.reporter_name.toLowerCase().includes(query) ||
            item.post_content?.toLowerCase().includes(query);
    });

    const getStatusBadge = (status: string) => {
        switch (status.toLowerCase()) {
            case 'pending': return <Badge variant="secondary">待处理</Badge>;
            case 'resolved':
            case 'reviewed': return <Badge variant="default" className="bg-green-600">已解决</Badge>;
            case 'ignored':
            case 'dismissed':
            case 'rejected': return <Badge variant="outline" className="text-muted-foreground">已忽略</Badge>;
            default: return <Badge variant="secondary">{status}</Badge>;
        }
    };

    const getSourceBadge = (source: string) => {
        if (source === 'feedback') return <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">产品反馈</Badge>;
        if (source === 'report') return <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50">动态举报</Badge>;
        if (source === 'territory_report') return <Badge variant="outline" className="border-purple-200 text-purple-700 bg-purple-50">领地举报</Badge>;
        return null;
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-card p-4 rounded-lg border">
                <Tabs value={filterTab} onValueChange={setFilterTab} className="w-full sm:w-auto">
                    <TabsList>
                        <TabsTrigger value="all">全部</TabsTrigger>
                        <TabsTrigger value="feedback">产品反馈</TabsTrigger>
                        <TabsTrigger value="report">动态举报</TabsTrigger>
                        <TabsTrigger value="territory_report">领地举报</TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="搜索内容/联系方式/提交人..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[100px]">类型</TableHead>
                            <TableHead className="w-[120px]">提交人</TableHead>
                            <TableHead>内容/说明</TableHead>
                            <TableHead className="w-[180px]">联系方式/来源</TableHead>
                            <TableHead className="w-[150px]">提交时间</TableHead>
                            <TableHead className="w-[100px]">状态</TableHead>
                            <TableHead className="w-[100px] text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredList.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                    没有找到对应的记录
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredList.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>{getSourceBadge(item.source)}</TableCell>
                                    <TableCell className="font-medium truncate max-w-[120px]">
                                        {item.reporter_name}
                                    </TableCell>
                                    <TableCell>
                                        <div className="max-w-[300px] truncate" title={item.content}>
                                            {item.content}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {item.contact_info || '-'}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {format(new Date(item.created_at), "yyyy-MM-dd HH:mm")}
                                    </TableCell>
                                    <TableCell>
                                        {getStatusBadge(item.status)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Dialog open={isDialogOpen && selectedItem?.id === item.id} onOpenChange={(open) => {
                                            setIsDialogOpen(open);
                                            if (open) setSelectedItem(item);
                                        }}>
                                            <DialogTrigger asChild>
                                                <Button variant="ghost" size="icon" onClick={() => setSelectedItem(item)}>
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
                                                <DialogHeader>
                                                    <DialogTitle className="flex items-center gap-2">
                                                        {item.source === 'feedback' ? <Bug className="w-5 h-5 text-blue-500" /> : <ShieldAlert className="w-5 h-5 text-red-500" />}
                                                        {item.source === 'feedback' ? '反馈详情' : item.source === 'report' ? '动态举报详情' : '领地举报详情'}
                                                    </DialogTitle>
                                                </DialogHeader>

                                                {selectedItem && (
                                                    <div className="space-y-6 mt-4">
                                                        <div className="grid grid-cols-2 gap-4 text-sm bg-muted/50 p-4 rounded-lg">
                                                            <div><span className="text-muted-foreground">提交人：</span> {selectedItem.reporter_name} ({selectedItem.user_id?.substring(0, 8) || '未知'})</div>
                                                            <div><span className="text-muted-foreground">时间：</span> {format(new Date(selectedItem.created_at), "yyyy-MM-dd HH:mm")}</div>
                                                            <div><span className="text-muted-foreground">状态：</span> {getStatusBadge(selectedItem.status)}</div>
                                                            <div><span className="text-muted-foreground">联系方式/来源：</span> {selectedItem.contact_info || '无'}</div>
                                                        </div>

                                                        {selectedItem.source === 'report' && (
                                                            <div className="space-y-2 border rounded-lg p-4 bg-red-50/50">
                                                                <h4 className="font-semibold text-sm text-red-800 flex items-center gap-1">被举报动态内容：</h4>
                                                                <p className="text-sm whitespace-pre-wrap">{selectedItem.post_content}</p>
                                                                {selectedItem.post_media && selectedItem.post_media.length > 0 && (
                                                                    <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
                                                                        {selectedItem.post_media.map((url, i) => (
                                                                            <a key={i} href={url} target="_blank" rel="noreferrer" className="flex-shrink-0">
                                                                                <img src={url} alt="media" className="h-20 w-20 object-cover rounded border" />
                                                                            </a>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {selectedItem.source === 'territory_report' && (
                                                            <div className="space-y-2 border rounded-lg p-4 bg-purple-50/50">
                                                                <h4 className="font-semibold text-sm text-purple-800 flex items-center gap-1">被举报领地信息：</h4>
                                                                <div className="text-sm space-y-1">
                                                                    <p><span className="text-muted-foreground">领地ID:</span> {selectedItem.territory_id}</p>
                                                                    <p><span className="text-muted-foreground">被举报领主:</span> {selectedItem.reported_user_name} ({selectedItem.reported_user_id?.substring(0, 8)})</p>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="space-y-2">
                                                            <h4 className="font-semibold text-sm">
                                                                {selectedItem.source === 'feedback' ? '反馈内容：' : '举报理由/说明：'}
                                                            </h4>
                                                            <p className="text-sm whitespace-pre-wrap bg-card border rounded-lg p-4 min-h-[100px]">
                                                                {selectedItem.content}
                                                            </p>
                                                        </div>

                                                        {selectedItem.screenshot_url && (
                                                            <div className="space-y-2">
                                                                <h4 className="font-semibold text-sm">关联截图：</h4>
                                                                <a href={selectedItem.screenshot_url} target="_blank" rel="noreferrer">
                                                                    <img
                                                                        src={selectedItem.screenshot_url}
                                                                        alt="反馈截图"
                                                                        className="max-w-full h-auto max-h-[300px] object-contain rounded-lg border bg-muted/20"
                                                                    />
                                                                </a>
                                                            </div>
                                                        )}

                                                        {/* Action Buttons */}
                                                        <div className="flex justify-end gap-3 pt-4 border-t">
                                                            {selectedItem.status.toLowerCase() === 'pending' && (
                                                                <>
                                                                    <Button
                                                                        variant="outline"
                                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                        onClick={() => handleUpdateStatus(
                                                                            selectedItem.id,
                                                                            selectedItem.source,
                                                                            selectedItem.source === 'feedback' ? 'ignored' : 'REJECTED'
                                                                        )}
                                                                    >
                                                                        <XCircle className="w-4 h-4 mr-1" />
                                                                        {selectedItem.source === 'feedback' ? '忽略反馈' : '驳回举报'}
                                                                    </Button>
                                                                    <Button
                                                                        className="bg-green-600 hover:bg-green-700"
                                                                        onClick={() => handleUpdateStatus(
                                                                            selectedItem.id,
                                                                            selectedItem.source,
                                                                            selectedItem.source === 'feedback' ? 'resolved' : 'RESOLVED'
                                                                        )}
                                                                    >
                                                                        <CheckCircle className="w-4 h-4 mr-1" />
                                                                        {selectedItem.source === 'feedback' ? '标为已解决' : '确认违规并处理'}
                                                                    </Button>
                                                                </>
                                                            )}

                                                            {selectedItem.status.toLowerCase() !== 'pending' && (
                                                                <Button
                                                                    variant="outline"
                                                                    onClick={() => handleUpdateStatus(selectedItem.id, selectedItem.source, 'PENDING')}
                                                                >
                                                                    重新打开 (设为待处理)
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </DialogContent>
                                        </Dialog>
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
