'use client'

/**
 * Admin Territories Page
 *
 * Full territory management UI:
 * - Searchable, filterable, paginated list
 * - HP reset (full / hp-only)
 * - Ownership transfer
 * - Cascading delete
 */

import { useCallback, useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { MapPin, RefreshCw, Trash2, ArrowRightLeft, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import {
  adminListTerritories,
  adminResetTerritoryHp,
  adminTransferTerritory,
  adminDeleteTerritory,
  type TerritoryAdminRow,
} from '@/app/actions/admin/territories'
import type { PaginationMeta } from '@/lib/admin/pagination'

const PAGE_SIZE = 20

export default function AdminTerritoriesPage() {
  const [territories, setTerritories] = useState<TerritoryAdminRow[]>([])
  const [pagination, setPagination] = useState<PaginationMeta | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'owned' | 'neutral'>('all')
  const [loading, setLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Transfer modal state
  const [transferTarget, setTransferTarget] = useState<TerritoryAdminRow | null>(null)
  const [transferUserId, setTransferUserId] = useState('')

  const loadTerritories = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminListTerritories({
        page,
        pageSize: PAGE_SIZE,
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: search || undefined,
      })
      if (res.success) {
        setTerritories(res.data)
        setPagination(res.pagination)
      } else {
        toast.error(res.error ?? '加载领地列表失败')
      }
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, search])

  useEffect(() => { loadTerritories() }, [loadTerritories])

  const handleResetHp = (t: TerritoryAdminRow, mode: 'full' | 'hp-only') => {
    startTransition(async () => {
      const res = await adminResetTerritoryHp(t.id, mode)
      if (res.success) {
        toast.success(res.message ?? 'HP 已重置')
        loadTerritories()
      } else {
        toast.error(res.error ?? '重置失败')
      }
    })
  }

  const handleTransfer = async () => {
    if (!transferTarget || !transferUserId.trim()) return
    startTransition(async () => {
      const res = await adminTransferTerritory(transferTarget.id, transferUserId.trim())
      if (res.success) {
        toast.success('所有权已转让')
        setTransferTarget(null)
        setTransferUserId('')
        loadTerritories()
      } else {
        toast.error(res.error ?? '转让失败')
      }
    })
  }

  const handleDelete = (t: TerritoryAdminRow) => {
    if (!confirm(`确认删除领地 ${t.id.slice(0, 12)}...?`)) return
    startTransition(async () => {
      const res = await adminDeleteTerritory(t.id)
      if (res.success) {
        toast.success('领地已删除')
        loadTerritories()
      } else {
        toast.error(res.error ?? '删除失败')
      }
    })
  }

  const hpColor = (hp: number, maxHp: number) => {
    const ratio = maxHp > 0 ? hp / maxHp : 0
    if (ratio > 0.6) return 'text-green-500'
    if (ratio > 0.3) return 'text-yellow-500'
    return 'text-red-500'
  }

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            领地管理
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="搜索领地 ID..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
            {(['all', 'owned', 'neutral'] as const).map((s) => (
              <Button
                key={s}
                variant={statusFilter === s ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setStatusFilter(s); setPage(1) }}
              >
                {{ all: '全部', owned: '已占领', neutral: '中立' }[s]}
              </Button>
            ))}
            <Button variant="outline" size="sm" onClick={loadTerritories} disabled={loading}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4">ID</th>
                    <th className="text-left py-2 pr-4">所有者</th>
                    <th className="text-left py-2 pr-4">阵营</th>
                    <th className="text-left py-2 pr-4">HP</th>
                    <th className="text-left py-2 pr-4">面积(m²)</th>
                    <th className="text-left py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {territories.map((t) => (
                    <tr key={t.id} className="border-b hover:bg-muted/40">
                      <td className="py-2 pr-4 font-mono text-xs">{t.id.slice(0, 12)}...</td>
                      <td className="py-2 pr-4">{t.owner_name ?? '中立'}</td>
                      <td className="py-2 pr-4">
                        {t.faction ? <Badge variant="outline">{t.faction}</Badge> : '—'}
                      </td>
                      <td className={`py-2 pr-4 font-semibold ${hpColor(t.hp, t.max_hp)}`}>
                        {t.hp}<span className="text-muted-foreground font-normal">/{t.max_hp}</span>
                      </td>
                      <td className="py-2 pr-4">
                        {t.area_m2 != null ? t.area_m2.toFixed(1) : '—'}
                      </td>
                      <td className="py-2">
                        <div className="flex gap-1 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResetHp(t, 'full')}
                            disabled={isPending}
                            title="全重置HP"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setTransferTarget(t)}
                            disabled={isPending}
                            title="转让所有权"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(t)}
                            disabled={isPending}
                            title="删除领地"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>共 {pagination.total} 条领地</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                >
                  上一页
                </Button>
                <span>{page} / {pagination.totalPages}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page >= pagination.totalPages || loading}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transfer Modal */}
      {transferTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>转让领地所有权</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                领地 ID: <code>{transferTarget.id.slice(0, 20)}...</code>
              </p>
              <Input
                placeholder="输入目标用户 ID (UUID)"
                value={transferUserId}
                onChange={(e) => setTransferUserId(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setTransferTarget(null); setTransferUserId('') }}>
                  取消
                </Button>
                <Button onClick={handleTransfer} disabled={!transferUserId.trim() || isPending}>
                  确认转让
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
