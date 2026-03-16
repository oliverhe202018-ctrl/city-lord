'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, ListChecks, X, Send } from 'lucide-react'
import { publishVersion } from '@/app/actions/admin/changelog-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
    createChangelogVersion, updateChangelogVersion, deleteChangelogVersion,
    createChangelogItem,    updateChangelogItem,    deleteChangelogItem,
    getVersionWithItems,
} from '@/app/actions/admin/changelog-actions'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChangelogItem {
    id: string; version_id: string; tag: string; content: string; sort_order: number
}
interface ChangelogVersion {
    id: string; version: string; title: string | null
    is_latest: boolean; release_date: string; published_at?: string | null
    changelog_items?: { count: number }[]
}

const TAG_OPTIONS = [
    { value: 'new_feature', label: '新功能'   },
    { value: 'improvement', label: '优化改进' },
    { value: 'bug_fix',     label: '问题修复' },
]
const TAG_STYLE: Record<string, string> = {
    new_feature: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
    improvement: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
    bug_fix:     'bg-red-500/15 text-red-600 border-red-500/30',
}
const TAG_LABEL: Record<string, string> = {
    new_feature: '新功能', improvement: '优化改进', bug_fix: '问题修复',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminChangelogClient({ initialVersions }: { initialVersions: ChangelogVersion[] }) {
    const [versions, setVersions]             = useState<ChangelogVersion[]>(initialVersions)
    const [isPending, startTransition]        = useTransition()
    const router = useRouter()

    // Version dialogs
    const [showCreateVersion, setShowCreateVersion] = useState(false)
    const [editingVersion, setEditingVersion]       = useState<ChangelogVersion | null>(null)
    const [deletingVersionId, setDeletingVersionId] = useState<string | null>(null)

    // Version form state
    const [vForm, setVForm] = useState({ version: '', title: '', is_latest: false, release_date: '' })

    // Items dialog
    const [itemsVersion, setItemsVersion] = useState<ChangelogVersion | null>(null)
    const [items, setItems]               = useState<ChangelogItem[]>([])
    const [loadingItems, setLoadingItems] = useState(false)

    // Item form state
    const [showAddItem, setShowAddItem]   = useState(false)
    const [editingItem, setEditingItem]   = useState<ChangelogItem | null>(null)
    const [deletingItemId, setDeletingItemId] = useState<string | null>(null)
    const [iForm, setIForm] = useState({ tag: 'new_feature', content: '', sort_order: '0' })

    // ── Reload helper ──
    function reloadPage() { window.location.reload() }

    // ── Version CRUD ──
    function openCreateVersion() {
        setVForm({ version: '', title: '', is_latest: false, release_date: '' })
        setShowCreateVersion(true)
    }
    function openEditVersion(v: ChangelogVersion) {
        setVForm({
            version:      v.version,
            title:        v.title ?? '',
            is_latest:    v.is_latest,
            release_date: v.release_date.slice(0, 10),
        })
        setEditingVersion(v)
    }

    function handleSaveVersion() {
        startTransition(async () => {
            const payload = {
                version:      vForm.version.trim(),
                title:        vForm.title.trim() || undefined,
                is_latest:    vForm.is_latest,
                release_date: vForm.release_date || undefined,
            }
            const res = editingVersion
                ? await updateChangelogVersion(editingVersion.id, payload)
                : await createChangelogVersion(payload)

            if (res.success) {
                toast.success(editingVersion ? '版本已更新' : '版本已创建')
                setShowCreateVersion(false)
                setEditingVersion(null)
                reloadPage()
            } else {
                toast.error(res.error ?? '操作失败')
            }
        })
    }

    function handleDeleteVersion() {
        if (!deletingVersionId) return
        startTransition(async () => {
            const res = await deleteChangelogVersion(deletingVersionId)
            if (res.success) {
                toast.success('版本已删除')
                setDeletingVersionId(null)
                reloadPage()
            } else {
                toast.error(res.error ?? '删除失败')
            }
        })
    }

    // ── Items Dialog ──
    async function openItemsDialog(v: ChangelogVersion) {
        setItemsVersion(v)
        setLoadingItems(true)
        const res = await getVersionWithItems(v.id)
        setItems(res.data?.changelog_items ?? [])
        setLoadingItems(false)
    }

    function openAddItem() {
        setIForm({ tag: 'new_feature', content: '', sort_order: String(items.length) })
        setShowAddItem(true)
    }
    function openEditItem(item: ChangelogItem) {
        setIForm({ tag: item.tag, content: item.content, sort_order: String(item.sort_order) })
        setEditingItem(item)
    }

    function handleSaveItem() {
        if (!itemsVersion) return
        startTransition(async () => {
            const payload = {
                version_id: itemsVersion.id,
                tag:        iForm.tag,
                content:    iForm.content.trim(),
                sort_order: parseInt(iForm.sort_order) || 0,
            }
            const res = editingItem
                ? await updateChangelogItem(editingItem.id, { tag: payload.tag, content: payload.content, sort_order: payload.sort_order })
                : await createChangelogItem(payload)

            if (res.success) {
                toast.success(editingItem ? '条目已更新' : '条目已添加')
                setShowAddItem(false)
                setEditingItem(null)
                const refreshed = await getVersionWithItems(itemsVersion.id)
                setItems(refreshed.data?.changelog_items ?? [])
            } else {
                toast.error(res.error ?? '操作失败')
            }
        })
    }

    function handleDeleteItem() {
        if (!deletingItemId) return
        startTransition(async () => {
            const res = await deleteChangelogItem(deletingItemId)
            if (res.success) {
                toast.success('条目已删除')
                setDeletingItemId(null)
                if (itemsVersion) {
                    const refreshed = await getVersionWithItems(itemsVersion.id)
                    setItems(refreshed.data?.changelog_items ?? [])
                }
            } else {
                toast.error(res.error ?? '删除失败')
            }
        })
    }

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <>
            {/* 版本列表 */}
            <div className="rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <span className="text-sm font-semibold text-foreground">所有版本</span>
                    <Button size="sm" onClick={openCreateVersion}>
                        <Plus className="mr-1.5 h-4 w-4" /> 新增版本
                    </Button>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>版本号</TableHead>
                            <TableHead>标题</TableHead>
                            <TableHead>状态</TableHead>
                            <TableHead>发布日期</TableHead>
                            <TableHead>条目数</TableHead>
                            <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {versions.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                                    暂无版本，点击「新增版本」开始
                                </TableCell>
                            </TableRow>
                        )}
                        {versions.map((v) => (
                            <TableRow key={v.id}>
                                <TableCell className="font-mono font-medium">v{v.version}</TableCell>
                                <TableCell className="text-muted-foreground">{v.title ?? '—'}</TableCell>
                                <TableCell>
                                    {v.is_latest && (
                                        <Badge className="bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 hover:bg-emerald-500/20">
                                            Latest
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                    {new Date(v.release_date).toLocaleDateString('zh-CN')}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                    {v.changelog_items?.[0]?.count ?? 0}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        {/* 仅未发布的版本显示发布按钮 */}
                                        {!(v as any).published_at && (
                                            <Button
                                                variant="ghost" size="sm"
                                                className="text-emerald-600 hover:text-emerald-600 hover:bg-emerald-500/10"
                                                onClick={() => {
                                                    startTransition(async () => {
                                                        const res = await publishVersion(v.id)
                                                        if (res.success) {
                                                            toast.success(`v${v.version} 已发布，Realtime 通知已触发`)
                                                            reloadPage()
                                                        } else {
                                                            toast.error(res.error ?? '发布失败')
                                                        }
                                                    })
                                                }}
                                            >
                                                <Send className="h-4 w-4" />
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-blue-500 hover:text-blue-500 hover:bg-blue-500/10"
                                            onClick={() => router.push(`/admin/changelog/${v.id}/edit`)}
                                            title="可视化编辑"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost" size="sm"
                                            onClick={() => openItemsDialog(v)}
                                        >
                                            <ListChecks className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost" size="sm"
                                            onClick={() => openEditVersion(v)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost" size="sm"
                                            className="text-destructive hover:text-destructive"
                                            onClick={() => setDeletingVersionId(v.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* ── 新增/编辑版本 Dialog ── */}
            <Dialog
                open={showCreateVersion || !!editingVersion}
                onOpenChange={(open) => { if (!open) { setShowCreateVersion(false); setEditingVersion(null) } }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingVersion ? '编辑版本' : '新增版本'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label>版本号 *</Label>
                            <Input
                                placeholder="如 3.3.6"
                                value={vForm.version}
                                onChange={(e) => setVForm(f => ({ ...f, version: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>标题（可选）</Label>
                            <Input
                                placeholder="如 社交功能大更新"
                                value={vForm.title}
                                onChange={(e) => setVForm(f => ({ ...f, title: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>发布日期</Label>
                            <Input
                                type="date"
                                value={vForm.release_date}
                                onChange={(e) => setVForm(f => ({ ...f, release_date: e.target.value }))}
                            />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border p-3">
                            <div>
                                <p className="text-sm font-medium text-foreground">标记为最新版本</p>
                                <p className="text-xs text-muted-foreground">会自动取消其他版本的 Latest 标记</p>
                            </div>
                            <Switch
                                checked={vForm.is_latest}
                                onCheckedChange={(v) => setVForm(f => ({ ...f, is_latest: v }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => { setShowCreateVersion(false); setEditingVersion(null) }}
                        >
                            取消
                        </Button>
                        <Button
                            disabled={!vForm.version.trim() || isPending}
                            onClick={handleSaveVersion}
                        >
                            {isPending ? '保存中…' : '保存'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── 删除版本 AlertDialog ── */}
            <AlertDialog open={!!deletingVersionId} onOpenChange={(o) => { if (!o) setDeletingVersionId(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认删除该版本？</AlertDialogTitle>
                        <AlertDialogDescription>
                            此操作不可撤销，该版本下的所有更新条目也将被一并删除。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={handleDeleteVersion}
                        >
                            确认删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── 条目管理 Dialog ── */}
            <Dialog open={!!itemsVersion} onOpenChange={(o) => { if (!o) { setItemsVersion(null); setItems([]) } }}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            v{itemsVersion?.version} 的更新条目
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 max-h-[50vh] overflow-y-auto py-1 pr-1">
                        {loadingItems && (
                            <p className="py-4 text-center text-sm text-muted-foreground">加载中…</p>
                        )}
                        {!loadingItems && items.length === 0 && (
                            <p className="py-4 text-center text-sm text-muted-foreground">
                                暂无条目，点击下方按钮添加
                            </p>
                        )}
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className="flex items-start gap-3 rounded-lg border border-border bg-card/50 p-3"
                            >
                                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${TAG_STYLE[item.tag] ?? ''}`}>
                                    {TAG_LABEL[item.tag] ?? item.tag}
                                </span>
                                <p className="flex-1 text-sm text-foreground">{item.content}</p>
                                <div className="flex shrink-0 gap-1">
                                    <button
                                        onClick={() => openEditItem(item)}
                                        className="rounded p-1 hover:bg-muted/30 transition-colors"
                                    >
                                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                    </button>
                                    <button
                                        onClick={() => setDeletingItemId(item.id)}
                                        className="rounded p-1 hover:bg-muted/30 transition-colors"
                                    >
                                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <DialogFooter className="border-t border-border pt-3">
                        <Button variant="outline" onClick={openAddItem}>
                            <Plus className="mr-1.5 h-4 w-4" /> 添加条目
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── 新增/编辑条目 Dialog ── */}
            <Dialog
                open={showAddItem || !!editingItem}
                onOpenChange={(o) => { if (!o) { setShowAddItem(false); setEditingItem(null) } }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingItem ? '编辑条目' : '添加更新条目'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label>标签类型</Label>
                            <Select value={iForm.tag} onValueChange={(v) => setIForm(f => ({ ...f, tag: v }))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TAG_OPTIONS.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>内容描述 *</Label>
                            <textarea
                                rows={3}
                                value={iForm.content}
                                onChange={(e) => setIForm(f => ({ ...f, content: e.target.value }))}
                                placeholder="描述该条更新内容…"
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>排列顺序（数字越小越靠前）</Label>
                            <Input
                                type="number"
                                value={iForm.sort_order}
                                onChange={(e) => setIForm(f => ({ ...f, sort_order: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => { setShowAddItem(false); setEditingItem(null) }}
                        >
                            取消
                        </Button>
                        <Button
                            disabled={!iForm.content.trim() || isPending}
                            onClick={handleSaveItem}
                        >
                            {isPending ? '保存中…' : '保存'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── 删除条目 AlertDialog ── */}
            <AlertDialog open={!!deletingItemId} onOpenChange={(o) => { if (!o) setDeletingItemId(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认删除该条目？</AlertDialogTitle>
                        <AlertDialogDescription>此操作不可撤销。</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={handleDeleteItem}
                        >
                            确认删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
