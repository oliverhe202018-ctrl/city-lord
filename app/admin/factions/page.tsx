"use client"

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { AlertCircle, Save, Users, Zap, TrendingUp, Calculator } from 'lucide-react'
import { Database } from '@/types/supabase'
import { toast } from 'sonner'
import { calculateFactionBalance, BalanceResult } from '@/utils/faction-balance'
import { getFactionStats } from '@/app/actions/faction'

type FactionBalanceConfig = Database['public']['Tables']['faction_balance_configs']['Row']

export default function FactionsPage() {
  // Stats State
  const [redCount, setRedCount] = useState(0)
  const [blueCount, setBlueCount] = useState(0)
  const [loadingStats, setLoadingStats] = useState(true)

  // Config State
  const [config, setConfig] = useState<any | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Use DB column names for state to avoid confusion
  const [formData, setFormData] = useState({
    imbalance_threshold: 20,
    underdog_multiplier: 1.5,
    auto_balance_enabled: true
  })

  // Simulator State
  const [simRed, setSimRed] = useState(1000)
  const [simBlue, setSimBlue] = useState(800)

  const supabase = createClient()

  // 1. Fetch Stats
  const fetchStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      // Use Server Action directly instead of API fetch
      const stats = await getFactionStats()
      
      setRedCount(stats.RED)
      setBlueCount(stats.BLUE)
    } catch (err: any) {
      console.error('Error fetching faction stats:', err)
      toast.error(`获取阵营数据失败: ${err.message}`)
    } finally {
      setLoadingStats(false)
    }
  }, [])

  // 2. Fetch Config
  const fetchConfig = useCallback(async () => {
    setLoadingConfig(true)
    try {
      const { data, error } = await supabase
        .from('faction_balance_configs')
        .select('*')
        .order('id', { ascending: true }) // Ensure deterministic ordering
        .limit(1)
        .maybeSingle() // Use maybeSingle to avoid 406 error on empty table

      if (error) throw error

      if (data) {
        // Data exists - map DB fields to state
        setConfig(data)
        setFormData({
          imbalance_threshold: (data as any).imbalance_threshold ?? 20,
          underdog_multiplier: (data as any).underdog_multiplier ?? 1.5,
          auto_balance_enabled: (data as any).auto_balance_enabled ?? true
        })
      } else {
        // No data, initialize immediately
        console.log("No faction config found, initializing default...")
        const defaultConfig = {
          imbalance_threshold: 20,
          underdog_multiplier: 1.5,
          auto_balance_enabled: true
        }
        
        const { data: newData, error: insertError } = await supabase
            .from('faction_balance_configs')
            .insert(defaultConfig)
            .select()
            .single()
            
        if (insertError) {
             console.error("Failed to auto-initialize config:", insertError)
             // Set form data anyway so user can try manual save
             setFormData(defaultConfig)
        } else {
             setConfig(newData)
             setFormData({
               imbalance_threshold: (newData as any).imbalance_threshold,
               underdog_multiplier: (newData as any).underdog_multiplier,
               auto_balance_enabled: (newData as any).auto_balance_enabled
             })
             toast.success("已自动初始化阵营平衡配置")
        }
      }
    } catch (err: any) {
      console.error('Error fetching config:', err)
      toast.error(`加载配置失败: ${err.message}`)
    } finally {
      setLoadingConfig(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchStats()
    fetchConfig()
  }, [fetchStats, fetchConfig])

  // 3. Save Config
  const logAction = async (action: string, details: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase.from('admin_logs').insert({
        admin_id: user.id,
        action,
        details
      })
    } catch (err) {
      console.error('Failed to write log:', err)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // 1. Check for existing record to determine ID
      const { data: existing, error: fetchError } = await supabase
        .from('faction_balance_configs')
        .select('id')
        .limit(1)
        .maybeSingle()

      if (fetchError) {
        throw new Error(`Check existing failed: ${fetchError.message}`)
      }

      // 2. Construct payload with strict type conversion
      const payload: any = {
        imbalance_threshold: Number(formData.imbalance_threshold || 20),
        underdog_multiplier: Number(formData.underdog_multiplier || 1.5),
        auto_balance_enabled: formData.auto_balance_enabled ?? true
      }

      // If ID exists, attach it to perform an UPDATE-like Upsert
      // If not, ID is undefined, performing an INSERT
      if (existing?.id) {
        payload.id = existing.id
      }

      // 3. Execute Upsert
      const { data, error } = await supabase
        .from('faction_balance_configs')
        .upsert(payload)
        .select()
        .single()

      if (error) {
        console.error('Save Error Details:', error)
        throw error
      }

      setConfig(data)
      
      await logAction(
        'update_faction_balance', 
        `更新阵营平衡配置: 自动平衡 ${payload.auto_balance_enabled ? '开' : '关'} (动态倍率算法已启用)`
      )

      toast.success('配置已保存')
    } catch (err: any) {
      console.error('Error saving config:', err)
      toast.error(`保存失败: ${err.message || '未知错误'}`, {
         description: err.details || '请检查控制台获取更多信息'
      })
    } finally {
      setSaving(false)
    }
  }

  // --- Real-time Calculations ---
  const currentBalance = calculateFactionBalance(
    redCount, 
    blueCount, 
    formData.auto_balance_enabled
  )

  const totalUsers = redCount + blueCount
  const redPercentage = totalUsers > 0 ? (redCount / totalUsers) * 100 : 50
  const bluePercentage = totalUsers > 0 ? (blueCount / totalUsers) * 100 : 50
  
  // --- Simulation Calculations ---
  const simBalance = calculateFactionBalance(
    simRed, 
    simBlue, 
    formData.auto_balance_enabled
  )
  const simTotal = simRed + simBlue
  const simDiff = Math.abs(simRed - simBlue)
  const simDiffPercent = simTotal > 0 ? (simDiff / simTotal) * 100 : 0

  // Custom Progress Bar Component
  const FactionProgressBar = ({ red, blue }: { red: number, blue: number }) => (
    <div className="relative h-8 w-full overflow-hidden rounded-full bg-slate-800">
      <div 
        className="absolute left-0 top-0 h-full bg-red-500 transition-all duration-500 flex items-center justify-start pl-3 text-xs font-bold text-white"
        style={{ width: `${red}%` }}
      >
        {red.toFixed(1)}%
      </div>
      <div 
        className="absolute right-0 top-0 h-full bg-blue-500 transition-all duration-500 flex items-center justify-end pr-3 text-xs font-bold text-white"
        style={{ width: `${blue}%` }}
      >
        {blue.toFixed(1)}%
      </div>
      <div className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-white/20" />
    </div>
  )

  if (loadingStats && loadingConfig) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">阵营管理</h2>
          <p className="text-muted-foreground">监控阵营平衡性并调整动态加成参数。</p>
        </div>
        <Button variant="outline" onClick={() => { fetchStats(); fetchConfig(); }}>刷新数据</Button>
      </div>

      {/* 1. Real-time Stats & Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            实时状态监控
          </CardTitle>
          <CardDescription>
            当前基于真实用户数据的平衡状态。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <FactionProgressBar red={redPercentage} blue={bluePercentage} />
            
            <div className="flex justify-between text-sm">
              <div className="flex flex-col items-start">
                <span className="font-bold text-red-500 text-lg">{redCount}</span>
                <span className="text-muted-foreground">红方人数</span>
              </div>
              
              <div className="flex flex-col items-center">
                {currentBalance.multiplier > 1.0 ? (
                  <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold animate-pulse">
                    触发加成: {currentBalance.multiplier.toFixed(1)}x
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                    平衡状态
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground mt-2">
                  差距: {(currentBalance.diffRatio * 100).toFixed(1)}%
                </span>
              </div>

              <div className="flex flex-col items-end">
                <span className="font-bold text-blue-500 text-lg">{blueCount}</span>
                <span className="text-muted-foreground">蓝方人数</span>
              </div>
            </div>

            {/* Dynamic Status Text */}
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              {currentBalance.underdog ? (
                <p>
                  当前差距 <span className="font-bold text-white">{(currentBalance.diffRatio * 100).toFixed(1)}%</span>，
                  <span className={`font-bold mx-1 ${currentBalance.underdog === 'red' ? 'text-red-500' : 'text-blue-500'}`}>
                    {currentBalance.underdog === 'red' ? '红方' : '蓝方'}
                  </span>
                  正享受
                  <span className="font-bold text-yellow-400 mx-1 text-lg">{currentBalance.multiplier.toFixed(1)}倍</span>
                  经验加成！
                </p>
              ) : (
                <p className="text-muted-foreground">当前人数差距未达到触发阈值 (20%)，无加成生效。</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Simulator (Playground) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            实时推演模拟器
          </CardTitle>
          <CardDescription>
            拖动滑块模拟人数变化，测试动态倍率算法的响应。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Red Slider */}
              <div className="space-y-4">
                <div className="flex justify-between">
                  <Label className="text-red-400">模拟红方人数</Label>
                  <span className="font-mono font-bold">{simRed}</span>
                </div>
                <Slider
                  value={[simRed]}
                  min={0}
                  max={5000}
                  step={10}
                  onValueChange={(vals) => setSimRed(vals[0])}
                  className="[&_.bg-primary]:bg-red-500"
                />
              </div>

              {/* Blue Slider */}
              <div className="space-y-4">
                <div className="flex justify-between">
                  <Label className="text-blue-400">模拟蓝方人数</Label>
                  <span className="font-mono font-bold">{simBlue}</span>
                </div>
                <Slider
                  value={[simBlue]}
                  min={0}
                  max={5000}
                  step={10}
                  onValueChange={(vals) => setSimBlue(vals[0])}
                  className="[&_.bg-primary]:bg-blue-500"
                />
              </div>
            </div>

            {/* Simulation Result */}
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-yellow-400 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-yellow-200 mb-1">推演结果：</p>
                  <p className="text-white/80">
                    如果红方 {simRed} 人，蓝方 {simBlue} 人：
                  </p>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-white/70">
                    <li>总人数: {simTotal}，差距: {simDiffPercent.toFixed(1)}%</li>
                    <li>
                      判定结果: 
                      {simBalance.multiplier > 1.0 ? (
                        <>
                          <span className={`font-bold mx-1 ${simBalance.underdog === 'red' ? 'text-red-400' : 'text-blue-400'}`}>
                            {simBalance.underdog === 'red' ? '红方' : '蓝方'}
                          </span>
                          获得 <span className="font-bold text-yellow-400">{simBalance.multiplier.toFixed(1)}倍</span> 加成
                        </>
                      ) : (
                        " 差距 < 20%，无加成"
                      )}
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Global Config Switch */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            系统开关
          </CardTitle>
          {!config?.id && !loadingConfig && (
            <CardDescription className="text-yellow-500 flex items-center gap-2">
               <AlertCircle className="h-4 w-4" />
               当前无配置数据，请点击下方按钮初始化。
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
            <div className="space-y-0.5">
              <Label className="text-base">自动平衡系统</Label>
              <p className="text-sm text-muted-foreground">
                关闭后，无论人数差距如何，所有阵营倍率均强制为 1.0x。
              </p>
            </div>
            <Switch
              checked={formData.auto_balance_enabled || false}
              onCheckedChange={(checked) => setFormData({ ...formData, auto_balance_enabled: checked })}
            />
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={handleSave} disabled={saving} className="w-full md:w-auto">
              {saving ? <Spinner className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
              {config?.id ? '保存设置' : '初始化配置'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
