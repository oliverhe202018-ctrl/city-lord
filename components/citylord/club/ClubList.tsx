'use client'

import { useState } from 'react'
import { useRegion } from '@/contexts/RegionContext'
import { Users, MapPin, CheckCircle2 } from 'lucide-react'
import { joinClub } from '@/app/actions/club'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'

export function ClubList() {
  const { region } = useRegion()
  const { province, cityName, countyName } = region || {}
  const [joinedClubs, setJoinedClubs] = useState<Set<string>>(new Set())
  const { toast } = useToast()

  // 获取位置名称，避免 undefined
  const locationName = cityName || countyName || '城市'

  // Mock club data for demonstration
  const availableClubs = [
    {
      id: '1',
      name: `${province || ''}${locationName}跑步俱乐部`,
      members: 7633,
      territory: '605.3 mi²',
      avatar: 'https://picsum.photos/id/64/40/40'
    },
    {
      id: '2',
      name: `${province || ''}快闪跑团`,
      members: 1500,
      territory: '61.0 mi²',
      avatar: 'https://picsum.photos/id/65/40/40'
    },
    {
      id: '3',
      name: `${locationName}晨跑俱乐部`,
      members: 1200,
      territory: '52.8 mi²',
      avatar: 'https://picsum.photos/id/66/40/40'
    },
    {
      id: '4',
      name: `${province || ''}夜跑团队`,
      members: 900,
      territory: '27.3 mi²',
      avatar: 'https://picsum.photos/id/67/40/40'
    },
    {
      id: '5',
      name: `${locationName}马拉松跑团`,
      members: 750,
      territory: '22.1 mi²',
      avatar: 'https://picsum.photos/id/68/40/40'
    }
  ]

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
          } else {
             // Mock success for demo if API fails (since backend might not have these mock clubs)
             setJoinedClubs(new Set([...joinedClubs, clubId]))
             toast({ title: '申请已提交', description: `(Mock) 已申请加入 ${clubName}` })
          }
      } catch (error) {
          // Fallback for mock demo
          setJoinedClubs(new Set([...joinedClubs, clubId]))
          toast({ title: '申请已提交', description: `(Mock) 已申请加入 ${clubName}` })
      }
    }
  }

  const handleViewClub = (clubId: string, clubName: string) => {
    toast({ title: '提示', description: `查看 ${clubName} 详情功能开发中...` })
  }

  return (
    <div className="p-4 text-white h-full overflow-auto">
      <h2 className="text-2xl font-bold mb-4">选择跑步俱乐部</h2>

      <div className="space-y-3 pb-20">
        {availableClubs.map(club => (
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
    </div>
  )
}
