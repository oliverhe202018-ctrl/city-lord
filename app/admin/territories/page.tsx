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
import { MapPin, RefreshCw, Trash2, ArrowRightLeft, Search, Shield } from 'lucide-react'
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
    if (!confirm(`确认删除领地 ${t.id.slice(0, 8)}... ？此操作不可撤销。`)) return
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

  const hpColor = (hp: number) =>
    hp >= 700 ? 'text-green-400' : hp >= 300 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 pt-[var(--safe-top,0px)]">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <MapPin className="w-6 h-6 text-blue-400" />
          <h1 className="text-2xl font-bold">领地管理</h1>
          <Badge variant="outline" className="ml-auto">
            {pagination?.total ?? 0} 个领地
          </Badge>
        </div>

        {/* Filters */}
        <Card className="mb-4 bg-gray-900 border-gray-800">
          <CardContent className="pt-4 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="搜索所有者名称 / ID..."
                className="pl-9 bg-gray-800 border-gray-700"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
            {(['all', 'owned', 'neutral'] as const).map(s => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? 'default' : 'outline'}
                onClick={() => { setStatusFilter(s); setPage(1) }}
              >
                {s === 'all' ? '全部' : s === 'owned' ? '已占领' : '中立'}
              </Button>
            ))}
            <Button size="sm" variant="outline" onClick={loadTerritories} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </CardContent>
        </Card>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 text-gray-400">
                <tr>
                  <th className="text-left p-3">ID</th>
                  <th className="text-left p-3">所有者</th>
                  <th className="text-left p-3">阵营</th>
                  <th className="text-right p-3">HP</th>
                  <th className="text-right p-3">护盾</th>
                  <th className="text-right p-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {territories.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-500">暂无数据</td></tr>
                )}
                {territories.map(t => (
                  <tr key={t.id} className="border-t border-gray-800 hover:bg-gray-900/50 transition-colors">
                    <td className="p-3 font-mono text-xs text-gray-400">{t.id.slice(0, 12)}...</td>
                    <td className="p-3">{t.owner_name ?? <span className="text-gray-500">中立</span>}</td>
                    <td className="p-3">
                      {t.faction ? (
                        <Badge variant="outline" className="text-xs">{t.faction}</Badge>
                      ) : '—'}
                    </td>
                    <td className={`p-3 text-right font-mono font-semibold ${hpColor(t.hp)}`}>
                      {t.hp}
                    </td>
                    <td className="p-3 text-right font-mono text-blue-300">{t.shield}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="重置 HP + 护盾"
                          disabled={isPending}
                          onClick={() => handleResetHp(t, 'full')}
                        >
                          <Shield className="w-4 h-4 text-green-400" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="仅重置 HP"
                          disabled={isPending}
                          onClick={() => handleResetHp(t, 'hp-only')}
                        >
                          <RefreshCw className="w-4 h-4 text-yellow-400" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="转让所有权"
                          disabled={isPending}
                          onClick={() => setTransferTarget(t)}
                        >
                          <ArrowRightLeft className="w-4 h-4 text-blue-400" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="删除领地"
                          disabled={isPending}
                          onClick={() => handleDelete(t)}
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
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
        {pagination && pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            <Button size="sm" variant="outline" disabled={!pagination.hasPrevPage} onClick={() => setPage(p => p - 1)}>上一页</Button>
            <span className="text-sm text-gray-400 self-center">{pagination.page} / {pagination.totalPages}</span>
            <Button size="sm" variant="outline" disabled={!pagination.hasNextPage} onClick={() => setPage(p => p + 1)}>下一页</Button>
          </div>
        )}

        {/* Transfer Modal */}
        {transferTarget && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <Card className="w-full max-w-md bg-gray-900 border-gray-700">
              <CardHeader><CardTitle>转让领地所有权</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-400">领地 ID: {transferTarget.id.slice(0, 16)}...</p>
                <Input
                  placeholder="输入目标用户 UUID"
                  className="bg-gray-800 border-gray-700"
                  value={transferUserId}
                  onChange={e => setTransferUserId(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={handleTransfer} disabled={isPending || !transferUserId.trim()}>确认转让</Button>
                  <Button variant="outline" className="flex-1" onClick={() => setTransferTarget(null)}>取消</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
