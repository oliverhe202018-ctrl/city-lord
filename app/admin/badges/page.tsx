import { prisma } from '@/lib/prisma'
import { BadgeList } from './BadgeList'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"
import { CreateBadgeButton } from './CreateBadgeButton'

export const dynamic = 'force-dynamic'

export default async function BadgesPage() {
  let badges = []
  try {
    badges = await prisma.badges.findMany({
      orderBy: { created_at: 'desc' }
    })
  } catch (e) {
    console.error("Failed to fetch badges:", e)
    // Don't throw, just return empty array
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">勋章管理</h2>
          <p className="text-muted-foreground">管理系统中的成就勋章。</p>
        </div>
        <CreateBadgeButton />
      </div>

      {badges.length === 0 ? (
        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertTitle>暂无勋章</AlertTitle>
          <AlertDescription>
            系统中尚未创建任何勋章。请点击右上角按钮创建第一个勋章。
          </AlertDescription>
        </Alert>
      ) : (
        <BadgeList initialBadges={badges} />
      )}
    </div>
  )
}
