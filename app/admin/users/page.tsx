"use client"

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { format } from 'date-fns'
import { Search, AlertCircle, Eye } from 'lucide-react'
import { Database } from '@/types/supabase'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

type Profile = Database['public']['Tables']['profiles']['Row']

export default function UsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const supabase = createClient()

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const fetchProfiles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (debouncedSearch) {
        query = query.ilike('nickname', `%${debouncedSearch}%`)
      }

      const { data, error } = await query

      if (error) throw error
      
      setProfiles(data || [])
    } catch (err: any) {
      console.error('Error fetching profiles:', err)
      setError(err.message || '获取用户列表失败')
    } finally {
      setLoading(false)
    }
  }, [supabase, debouncedSearch])

  useEffect(() => {
    fetchProfiles()
  }, [fetchProfiles])

  if (loading && profiles.length === 0) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-[50vh] w-full flex-col items-center justify-center gap-4 text-destructive">
        <AlertCircle className="h-12 w-12" />
        <p className="text-lg font-medium">{error}</p>
        <Button onClick={fetchProfiles} variant="outline">重试</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">用户管理</h2>
          <p className="text-muted-foreground">查看和管理所有注册用户。</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="搜索昵称..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>用户列表 ({profiles.length})</CardTitle>
          <CardDescription>
            {debouncedSearch ? `显示匹配 "${debouncedSearch}" 的用户` : '显示最近注册的用户'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground border rounded-md border-dashed">
              {debouncedSearch ? '未找到匹配的用户' : '暂无用户数据'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">头像</TableHead>
                  <TableHead>昵称 / ID</TableHead>
                  <TableHead>注册时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell>
                      <Avatar>
                        <AvatarImage src={profile.avatar_url || undefined} alt={profile.nickname || 'User'} />
                        <AvatarFallback>{(profile.nickname || 'U').substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{profile.nickname || '未设置昵称'}</span>
                        <span className="text-xs text-muted-foreground font-mono">{profile.id}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {profile.created_at ? format(new Date(profile.created_at), 'yyyy-MM-dd HH:mm') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        <Eye className="mr-2 h-4 w-4" />
                        查看详情
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
