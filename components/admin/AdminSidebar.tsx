"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, 
  Users, 
  ShieldAlert, 
  FileText, 
  LogOut,
  Settings,
  Flag,
  Award,
  MessageSquareWarning
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

const sidebarItems = [
  {
    title: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard
  },
  {
    title: '俱乐部审核',
    href: '/admin/clubs',
    icon: ShieldAlert
  },
  {
    title: '勋章管理',
    href: '/admin/badges',
    icon: Award
  },
  {
    title: '用户管理',
    href: '/admin/users',
    icon: Users
  },
  {
    title: '房间管理',
    href: '/admin/rooms',
    icon: Settings
  },
  {
    title: '任务配置',
    href: '/admin/missions',
    icon: FileText
  },
  {
    title: '阵营管理',
    href: '/admin/factions',
    icon: Flag
  },
  {
    title: '用户反馈',
    href: '/admin/feedback',
    icon: MessageSquareWarning
  },
  {
    title: '系统日志',
    href: '/admin/logs',
    icon: FileText
  }
]

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/login')
      toast.success('已退出登录')
    } catch (error) {
      toast.error('退出登录失败')
    }
  }

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-card text-card-foreground">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-xl font-bold tracking-tight text-primary">CityLord Admin</h1>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-2">
          {sidebarItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                  isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                )}
              >
                <Icon className={cn("mr-3 h-5 w-5 flex-shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary")} />
                {item.title}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="border-t p-4">
        <div className="space-y-1">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-muted-foreground hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="mr-3 h-5 w-5" />
            退出登录
          </Button>
        </div>
      </div>
    </div>
  )
}
