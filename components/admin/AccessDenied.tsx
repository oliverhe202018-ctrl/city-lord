import Link from "next/link"
import { ShieldX } from "lucide-react"
import { Button } from "@/components/ui/button"

export function AccessDenied() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 mb-6">
        <ShieldX className="h-10 w-10 text-destructive" />
      </div>
      <h1 className="text-4xl font-bold tracking-tight mb-2">403 Access Denied</h1>
      <p className="text-muted-foreground max-w-[500px] mb-8">
        您没有权限访问此页面。此区域仅限管理员访问。如果您认为这是一个错误，请联系系统管理员。
      </p>
      <div className="flex gap-4">
        <Button asChild variant="default">
          <Link href="/">返回首页</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/login">重新登录</Link>
        </Button>
      </div>
    </div>
  )
}
