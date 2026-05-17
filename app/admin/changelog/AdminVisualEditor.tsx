'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
    DndContext, closestCenter, KeyboardSensor,
    PointerSensor, useSensor, useSensors,
    type DragEndEvent,
} from '@dnd-kit/core'
import {
    SortableContext, sortableKeyboardCoordinates,
    verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
    ArrowLeft, GripVertical, Plus, Pencil, Trash2,
    Send, CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { Label }    from '@/components/ui/label'
import { Switch }   from '@/components/ui/switch'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
    updateChangelogVersion, updateChangelogItem, deleteChangelogItem,
    batchUpdateSortOrders, createChangelogItemWithReturn, publishVersion,
} from '@/app/actions/admin/changelog-actions'

// ─── Constants ────────────────────────────────────────────────────────────────

const TAG_CONFIG: Record<string, { label: string; className: string }> = {
    new_feature: { label: '新功能',   className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
    improvement: { label: '优化改进', className: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
    bug_fix:     { label: '问题修复', className: 'bg-red-500/15 text-red-600 border-red-500/30' },
}
const TAG_OPTIONS = [
    { value: 'new_feature', label: '新功能'   },
    { value: 'improvement', label: '优化改进' },
    { value: 'bug_fix',     label: '问题修复' },
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface ItemData {
    id: string; version_id: string; tag: string; content: string; sort_order: number
}
interface VersionData {
    id: string; version: string; title: string | null; is_latest: boolean
    release_date: string; published_at: string | null
    changelog_items: ItemData[]
}

// ─── SortableItem ─────────────────────────────────────────────────────────────

interface SortableItemProps {
    item:          ItemData
    isEditing:     boolean
    editData:      { tag: string; content: string }
    isSaving:      boolean
    onEditStart:   () => void
    onEditChange:  (field: 'tag' | 'content', value: string) => void
    onEditSave:    () => void
    onEditCancel:  () => void
    onDelete:      () => void
}

function SortableItem({
    item, isEditing, editData, isSaving,
    onEditStart, onEditChange, onEditSave, onEditCancel, onDelete,
}: SortableItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: item.id })

    const style = { transform: CSS.Transform.toString(transform), transition }
    const tagConf = TAG_CONFIG[item.tag] ?? { label: item.tag, className: 'bg-muted/50 text-muted-foreground border-border' }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                'rounded-xl border border-border bg-card transition-shadow',
                isDragging && 'shadow-xl ring-1 ring-primary/30 opacity-75'
            )}
        >
            {isEditing ? (
                <div className="space-y-3 p-3">
                    <Select value={editData.tag} onValueChange={(v) => onEditChange('tag', v)}>
                        <SelectTrigger className="h-8 text-sm">
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
                    <textarea
                        value={editData.content}
                        onChange={(e) => onEditChange('content', e.target.value)}
                        rows={3}
                        autoFocus
                        className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            disabled={!editData.content.trim() || isSaving}
                            onClick={onEditSave}
                        >
                            {isSaving ? '保存中…' : '保存'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={onEditCancel}>
                            取消
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex items-start gap-2 p-3">
                    <button
                        {...attributes}
                        {...listeners}
                        className="mt-0.5 shrink-0 cursor-grab touch-none active:cursor-grabbing"
                        aria-label="拖拽排序"
                    >
                        <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                    </button>
                    <span className={cn(
                        'shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium',
                        tagConf.className
                    )}>
                        {tagConf.label}
                    </span>
                    <p className="flex-1 text-sm leading-relaxed text-foreground">
                        {item.content}
                    </p>
                    <div className="flex shrink-0 gap-0.5">
                        <button
                            onClick={onEditStart}
                            className="rounded p-1 transition-colors hover:bg-muted/30"
                        >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button
                            onClick={onDelete}
                            className="rounded p-1 transition-colors hover:bg-muted/30"
                        >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── PhonePreview ─────────────────────────────────────────────────────────────

function PhonePreview({
    version, title, is_latest, items,
}: {
    version: string; title: string; is_latest: boolean; items: ItemData[]
}) {
    return (
        <div className="hidden xl:flex w-[340px] shrink-0 flex-col items-center overflow-y-auto border-l border-border bg-muted/5 p-6">
            <p className="mb-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                实时预览
            </p>

            {/* Phone frame */}
            <div
                className="relative flex w-[256px] shrink-0 flex-col overflow-hidden rounded-[2.25rem] border-[10px] border-muted bg-background shadow-2xl"
                style={{ height: '508px' }}
            >
                {/* Notch */}
                <div className="absolute left-1/2 top-2 z-10 h-3.5 w-16 -translate-x-1/2 rounded-full bg-muted" />

                {/* Status bar */}
                <div className="flex items-center justify-between px-4 pb-1 pt-5 text-[9px] text-foreground/60">
                    <span className="font-medium">9:41</span>
                    <div className="flex items-center gap-1">
                        {/* Signal bars */}
                        <div className="flex items-end gap-px">
                            {[2, 3, 4, 5].map(h => (
                                <div
                                    key={h}
                                    className="w-0.5 rounded-sm bg-foreground/60"
                                    style={{ height: `${h * 1.5}px` }}
                                />
                            ))}
                        </div>
                        {/* Battery */}
                        <div className="relative h-2 w-3.5 rounded-sm border border-foreground/60">
                            <div className="absolute inset-0.5 rounded-sm bg-foreground/60" />
                        </div>
                    </div>
                </div>

                {/* Simulated header */}
                <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted/40">
                        <ArrowLeft className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1">
                            <span className="text-[11px] font-bold text-foreground">
                                v{version || '—'}
                            </span>
                            {is_latest && (
                                <span className="rounded-full bg-emerald-500 px-1 py-px text-[7px] font-medium text-white">
                                    Latest
                                </span>
                            )}
                        </div>
                        {title && (
                            <p className="truncate text-[8px] text-muted-foreground">{title}</p>
                        )}
                    </div>
                </div>

                {/* Items preview */}
                <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
                    {items.length === 0 ? (
                        <p className="py-6 text-center text-[10px] text-muted-foreground">
                            暂无条目
                        </p>
                    ) : items.map(item => {
                        const conf = TAG_CONFIG[item.tag] ?? {
                            label: item.tag,
                            className: 'bg-muted/50 text-muted-foreground border-border',
                        }
                        return (
                            <div
                                key={item.id}
                                className="flex items-start gap-1.5 rounded-lg border border-border p-1.5"
                            >
                                <span className={cn(
                                    'shrink-0 rounded-full border px-1.5 py-px text-[7px] font-medium',
                                    conf.className
                                )}>
                                    {conf.label}
                                </span>
                                <p className="line-clamp-3 text-[9px] leading-relaxed text-foreground">
                                    {item.content || '…'}
                                </p>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

// ─── AdminVisualEditor ────────────────────────────────────────────────────────

export function AdminVisualEditor({ initialData }: { initialData: VersionData }) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    // Version metadata
    const [meta, setMeta] = useState({
        title:        initialData.title ?? '',
        is_latest:    initialData.is_latest,
        release_date: initialData.release_date.slice(0, 10),
    })

    // Items
    const [items, setItems] = useState<ItemData[]>(
        [...(initialData.changelog_items ?? [])].sort((a, b) => a.sort_order - b.sort_order)
    )

    // Inline item editing
    const [editingItemId, setEditingItemId] = useState<string | null>(null)
    const [editingData, setEditingData]     = useState({ tag: 'new_feature', content: '' })
    const [isItemSaving, setIsItemSaving]   = useState(false)

    // Add item form
    const [showAddForm, setShowAddForm] = useState(false)
    const [newItem, setNewItem]         = useState({ tag: 'new_feature', content: '' })

    // Publish state
    const [isPublished, setIsPublished]         = useState(!!initialData.published_at)
    const [showPublishConfirm, setShowPublishConfirm] = useState(false)

    // ── DnD ──
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (!over || active.id === over.id) return

        const oldIndex = items.findIndex(i => i.id === active.id)
        const newIndex = items.findIndex(i => i.id === over.id)
        const reordered = arrayMove(items, oldIndex, newIndex)
        setItems(reordered)

        startTransition(async () => {
            const res = await batchUpdateSortOrders(
                reordered.map((item, idx) => ({ id: item.id, sort_order: idx }))
            )
            if (!res.success) toast.error('排序保存失败')
        })
    }

    // ── Meta auto-save on blur ──
    const handleMetaBlur = useCallback(() => {
        startTransition(async () => {
            const res = await updateChangelogVersion(initialData.id, {
                title:        meta.title.trim() || undefined,
                is_latest:    meta.is_latest,
                release_date: meta.release_date || undefined,
            })
            if (res.success) {
                toast.success('已保存', { duration: 1000 })
            } else {
                toast.error(res.error ?? '保存失败')
            }
        })
    }, [initialData.id, meta])

    // ── Item editing ──
    function startEdit(item: ItemData) {
        setEditingItemId(item.id)
        setEditingData({ tag: item.tag, content: item.content })
    }

    async function saveEdit() {
        if (!editingItemId) return
        setIsItemSaving(true)
        const res = await updateChangelogItem(editingItemId, {
            tag:     editingData.tag,
            content: editingData.content.trim(),
        })
        setIsItemSaving(false)
        if (res.success) {
            setItems(prev => prev.map(i =>
                i.id === editingItemId
                    ? { ...i, tag: editingData.tag, content: editingData.content.trim() }
                    : i
            ))
            setEditingItemId(null)
            toast.success('条目已更新', { duration: 1000 })
        } else {
            toast.error(res.error ?? '更新失败')
        }
    }

    async function handleDeleteItem(id: string) {
        const res = await deleteChangelogItem(id)
        if (res.success) {
            setItems(prev => prev.filter(i => i.id !== id))
            toast.success('条目已删除', { duration: 1000 })
        } else {
            toast.error(res.error ?? '删除失败')
        }
    }

    // ── Add item ──
    async function handleAddItem() {
        if (!newItem.content.trim()) return
        const res = await createChangelogItemWithReturn({
            version_id: initialData.id,
            tag:        newItem.tag,
            content:    newItem.content.trim(),
            sort_order: items.length,
        })
        if (res.data) {
            setItems(prev => [...prev, res.data as ItemData])
            setNewItem({ tag: 'new_feature', content: '' })
            setShowAddForm(false)
            toast.success('条目已添加', { duration: 1000 })
        } else {
            toast.error(res.error ?? '添加失败')
        }
    }

    // ── Publish ──
    async function handlePublish() {
        startTransition(async () => {
            const res = await publishVersion(initialData.id)
            if (res.success) {
                setIsPublished(true)
                setShowPublishConfirm(false)
                toast.success(`v${initialData.version} 已发布，Realtime 通知已推送`)
            } else {
                toast.error(res.error ?? '发布失败')
                setShowPublishConfirm(false)
            }
        })
    }

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="flex h-screen overflow-hidden bg-background">

            {/* ── Left: Editor ── */}
            <div className="flex flex-1 flex-col overflow-hidden">

                {/* Sticky top bar */}
                <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/admin/changelog')}
                            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-muted/30"
                        >
                            <ArrowLeft className="h-5 w-5 text-foreground" />
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-base font-bold text-foreground">
                                    v{initialData.version}
                                </h1>
                                {isPublished ? (
                                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600">
                                        <CheckCircle2 className="h-3 w-3" />已发布
                                    </span>
                                ) : (
                                    <span className="rounded-full bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
                                        草稿
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">可视化编辑器</p>
                        </div>
                    </div>

                    {/* Publish control */}
                    {!isPublished && (
                        !showPublishConfirm ? (
                            <Button
                                size="sm"
                                className="bg-emerald-500 text-white hover:bg-emerald-600"
                                onClick={() => setShowPublishConfirm(true)}
                            >
                                <Send className="mr-1.5 h-4 w-4" />
                                发布版本
                            </Button>
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                    确认发布并推送通知？
                                </span>
                                <Button
                                    size="sm"
                                    className="bg-emerald-500 text-white hover:bg-emerald-600"
                                    disabled={isPending}
                                    onClick={handlePublish}
                                >
                                    确认
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setShowPublishConfirm(false)}
                                >
                                    取消
                                </Button>
                            </div>
                        )
                    )}
                </div>

                {/* Scrollable editor body */}
                <div className="flex-1 space-y-6 overflow-y-auto p-5">

                    {/* Metadata */}
                    <section>
                        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            版本信息
                        </h2>
                        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs">标题（可选）</Label>
                                <Input
                                    value={meta.title}
                                    onChange={(e) => setMeta(m => ({ ...m, title: e.target.value }))}
                                    onBlur={handleMetaBlur}
                                    placeholder="如：社交功能大更新"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">发布日期</Label>
                                <Input
                                    type="date"
                                    value={meta.release_date}
                                    onChange={(e) => setMeta(m => ({ ...m, release_date: e.target.value }))}
                                    onBlur={handleMetaBlur}
                                />
                            </div>
                            <div className="flex items-center justify-between rounded-lg border border-border p-3">
                                <div>
                                    <p className="text-sm font-medium text-foreground">标记为最新版本</p>
                                    <p className="text-xs text-muted-foreground">显示 Latest 徽章</p>
                                </div>
                                <Switch
                                    checked={meta.is_latest}
                                    onCheckedChange={(v) => {
                                        setMeta(m => ({ ...m, is_latest: v }))
                                        startTransition(async () => {
                                            await updateChangelogVersion(initialData.id, { is_latest: v })
                                        })
                                    }}
                                />
                            </div>
                        </div>
                    </section>

                    {/* Items */}
                    <section>
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                更新条目（{items.length}）
                            </h2>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={showAddForm}
                                onClick={() => setShowAddForm(true)}
                            >
                                <Plus className="mr-1 h-3.5 w-3.5" />
                                添加
                            </Button>
                        </div>

                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={items.map(i => i.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-2">
                                    {items.length === 0 && !showAddForm && (
                                        <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                                            暂无条目，点击「添加」开始
                                        </p>
                                    )}
                                    {items.map(item => (
                                        <SortableItem
                                            key={item.id}
                                            item={item}
                                            isEditing={editingItemId === item.id}
                                            editData={editingData}
                                            isSaving={isItemSaving}
                                            onEditStart={() => startEdit(item)}
                                            onEditChange={(f, v) => setEditingData(d => ({ ...d, [f]: v }))}
                                            onEditSave={saveEdit}
                                            onEditCancel={() => setEditingItemId(null)}
                                            onDelete={() => handleDeleteItem(item.id)}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>

                        {/* Inline add form */}
                        {showAddForm && (
                            <div className="mt-2 space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                                <Select
                                    value={newItem.tag}
                                    onValueChange={(v) => setNewItem(i => ({ ...i, tag: v }))}
                                >
                                    <SelectTrigger className="h-8 text-sm">
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
                                <textarea
                                    value={newItem.content}
                                    onChange={(e) => setNewItem(i => ({ ...i, content: e.target.value }))}
                                    placeholder="描述该条更新内容…"
                                    rows={3}
                                    autoFocus
                                    className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                />
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        disabled={!newItem.content.trim()}
                                        onClick={handleAddItem}
                                    >
                                        添加条目
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                            setShowAddForm(false)
                                            setNewItem({ tag: 'new_feature', content: '' })
                                        }}
                                    >
                                        取消
                                    </Button>
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            </div>

            {/* ── Right: Phone Preview ── */}
            <PhonePreview
                version={initialData.version}
                title={meta.title}
                is_latest={meta.is_latest}
                items={items}
            />
        </div>
    )
}
