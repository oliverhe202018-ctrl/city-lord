"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Users, Shield, TrendingUp, UserCheck, AlertCircle, CheckCircle2 } from "lucide-react"
import { createClient } from '@/lib/supabase/client'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Link from 'next/link'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState<any>(null)
  const [trend, setTrend] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        // 1. Get Summary (RPC)
        const { data: summaryData } = await supabase.rpc('get_dashboard_summary')
        if (summaryData) setSummary(summaryData)

        // 2. Get Trend (RPC)
        const { data: trendData } = await supabase.rpc('get_user_growth_trend')
        if (trendData) setTrend(trendData)

        // 3. Get Logs
        const { data: logsData } = await supabase
          .from('admin_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10)
        
        if (logsData) setLogs(logsData)

      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Calculate percentages for faction bar
  const totalFaction = (summary?.red_faction || 0) + (summary?.blue_faction || 0)
  const redPercent = totalFaction > 0 ? (summary?.red_faction / totalFaction) * 100 : 50
  const bluePercent = totalFaction > 0 ? (summary?.blue_faction / totalFaction) * 100 : 50

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">欢迎回来，管理员。这里是系统概览。</p>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Users */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总用户数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.total_users || 0}</div>
            <p className="text-xs text-muted-foreground">
              今日新增 +{summary?.new_users_today || 0}
            </p>
          </CardContent>
        </Card>
        
        {/* Pending Audits */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">待审核俱乐部</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary?.pending_audit > 0 ? 'text-red-500' : ''}`}>
              {summary?.pending_audit || 0}
            </div>
            {summary?.pending_audit > 0 ? (
              <Link href="/admin/clubs" className="text-xs text-red-500 underline hover:text-red-600 flex items-center gap-1 mt-1">
                立即去审核 <TrendingUp className="h-3 w-3" />
              </Link>
            ) : (
              <p className="text-xs text-muted-foreground">当前无待办事项</p>
            )}
          </CardContent>
        </Card>
        
        {/* Active Clubs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">活跃俱乐部</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.total_clubs || 0}</div>
            <p className="text-xs text-muted-foreground">社区持续增长中</p>
          </CardContent>
        </Card>

        {/* Faction Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">阵营态势</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-end mb-2">
               <span className="text-2xl font-bold text-red-500">{summary?.red_faction || 0}</span>
               <span className="text-sm text-muted-foreground">vs</span>
               <span className="text-2xl font-bold text-blue-500">{summary?.blue_faction || 0}</span>
            </div>
            {/* Mini Progress Bar */}
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
               <div className="bg-red-500 h-full transition-all duration-500" style={{ width: `${redPercent}%` }} />
               <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${bluePercent}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Trend Chart */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>用户增长趋势</CardTitle>
            <CardDescription>
              过去 30 天的注册用户数量变化。
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              {trend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="report_date" 
                      tickLine={false} 
                      axisLine={false} 
                      tick={{fontSize: 12, fill: '#6b7280'}}
                      tickFormatter={(val) => val.slice(5)} // Show MM-DD
                    />
                    <YAxis 
                      tickLine={false} 
                      axisLine={false} 
                      tick={{fontSize: 12, fill: '#6b7280'}}
                      allowDecimals={false}
                    />
                    <Tooltip 
                       contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                       cursor={{ stroke: '#9ca3af', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="user_count" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorCount)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                   {loading ? "加载中..." : "暂无趋势数据"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Recent Audit Logs */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>最近操作日志</CardTitle>
            <CardDescription>
              管理员的最新管理活动。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
               {logs.length > 0 ? (
                 logs.map((log) => (
                   <div key={log.id} className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0">
                      <div className="mt-1">
                         {log.action.includes('reject') || log.action.includes('ban') ? (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                         ) : (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                         )}
                      </div>
                      <div className="flex-1 space-y-1">
                         <p className="text-sm font-medium leading-none">{log.action}</p>
                         <p className="text-xs text-muted-foreground line-clamp-2">
                           {log.details || '无详细信息'}
                         </p>
                         <p className="text-[10px] text-muted-foreground/60">
                           {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                         </p>
                      </div>
                   </div>
                 ))
               ) : (
                 <div className="flex h-[200px] items-center justify-center text-muted-foreground text-sm">
                    {loading ? "加载中..." : "暂无日志记录"}
                 </div>
               )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
