import { prisma } from '@/lib/prisma'
import { BadgeList } from './BadgeList'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"
import { CreateBadgeButton } from './CreateBadgeButton'

export const dynamic = 'force-dynamic'

export default async function BadgesPage() {
  const badges = await prisma.badges.findMany({
    orderBy: {
      category: 'asc'
    }
  })

  // Format image paths correctly
  const formattedBadges = badges.map(badge => ({
    ...badge,
    image: badge.icon_name ? `/badges/${badge.icon_name}` : '/badges/default.png',
    // Map database fields to UI expected fields if necessary
    rarity: badge.tier || 'bronze',
    maxProgress: Number(badge.requirement_value) || 0
  }))

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">徽章管理</h1>
          <p className="text-muted-foreground mt-2">
            管理系统中的所有徽章、成就及其解锁条件。
          </p>
        </div>
        <CreateBadgeButton />
      </div>

      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertTitle>提示</AlertTitle>
        <AlertDescription>
          徽章图片应上传至 /public/badges 目录。修改条件后，仅对新触发的行为生效。
        </AlertDescription>
      </Alert>

      <BadgeList initialBadges={formattedBadges} />
    </div>
  )
}
