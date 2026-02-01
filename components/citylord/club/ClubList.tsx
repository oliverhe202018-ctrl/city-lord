'use client'

import { useState, useEffect } from 'react'
import { useRegion } from '@/contexts/RegionContext'
import { Users, MapPin, CheckCircle2, Loader2 } from 'lucide-react'
import { joinClub, getClubs } from '@/app/actions/club'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'

export function ClubList() {
  const { region } = useRegion()
  const { province, cityName, countyName } = region || {}
  const [joinedClubs, setJoinedClubs] = useState<Set<string>>(new Set())
  const [clubs, setClubs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // 获取位置名称，避免 undefined
  const locationName = cityName || countyName || '城市'

  useEffect(() => {
    const fetchClubs = async () => {
      try {
        setLoading(true)
        const data = await getClubs()
        setClubs(data)
        
        // Update joined clubs set
        const joined = new Set<string>()
        data.forEach((club: any) => {
          if (club.isJoined) joined.add(club.id)
        })
        setJoinedClubs(joined)
      } catch (error) {
        console.error('Failed to fetch clubs:', error)
        toast({ 
          title: '加载失败', 
          description: '无法获取俱乐部列表，请稍后重试',
          variant: 'destructive'
        })
      } finally {
        setLoading(false)
      }
    }
    
    fetchClubs()
  }, [toast])

  const handleJoinClub = async (clubId: string, clubName: string) => {
    if (joinedClubs.has(clubId)) {
      toast({ title: '提示', description: `你已经是 ${clubName} 的成员了！` })
      return
    }

    const confirm = window.confirm(`确定要申请加入 ${clubName} 吗？`)
    if (confirm) {
      try {
          const res = await joinClub(clubId)
          if (res.success) {
             setJoinedClubs(new Set([...joinedClubs, clubId]))
             toast({ title: '申请已提交', description: `已申请加入 ${clubName}，请等待审核。` })
          } 
      } catch (error: any) {
          toast({ 
            title: '申请失败', 
            description: error.message || '未知错误',
            variant: 'destructive'
          })
      }
    }
  }

  const handleViewClub = (clubId: string, clubName: string) => {
    toast({ title: '提示', description: `查看 ${clubName} 详情功能开发中...` })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-white/50">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 text-white h-full overflow-auto">
      <h2 className="text-2xl font-bold mb-4">选择跑步俱乐部</h2>

      {clubs.length === 0 ? (
        <div className="text-center py-10 text-white/50">
          <p>暂无俱乐部</p>
          <p className="text-sm mt-2">你可以创建一个新的俱乐部！</p>
        </div>
      ) : (
        <div className="space-y-3 pb-20">
          {clubs.map(club => (
            <div
              key={club.id}
              onClick={() => handleViewClub(club.id, club.name)}
              className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 cursor-pointer transition-colors"
            >
              <img src={club.avatar} alt={club.name} className="w-12 h-12 rounded-full flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold flex items-center gap-2 truncate">
                  {club.name}
                  {joinedClubs.has(club.id) && (
                    <span className="flex items-center gap-1 text-green-400 text-xs flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                      已申请
                    </span>
                  )}
                </div>
                <div className="text-sm text-white/60 flex items-center gap-3 sm:gap-4">
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <Users className="w-3 h-3 flex-shrink-0" />
                    <span>{club.members} 位成员</span>
                  </span>
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span>{club.territory}</span>
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                variant={joinedClubs.has(club.id) ? "secondary" : "outline"}
                onClick={(e) => {
                  e.stopPropagation()
                  handleJoinClub(club.id, club.name)
                }}
                disabled={joinedClubs.has(club.id)}
                className={`h-8 text-xs ${
                   !joinedClubs.has(club.id) ? "border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10" : ""
                }`}
              >
                {joinedClubs.has(club.id) ? '已申请' : '加入'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
