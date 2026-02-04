import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function AuthErrorPage(props: Props) {
  const searchParams = await props.searchParams
  const message = searchParams.message

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0f1a] p-4">
      <Card className="w-full max-w-md border-white/10 bg-black/40 backdrop-blur-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <AlertTriangle className="h-6 w-6 text-red-500" />
          </div>
          <CardTitle className="text-xl text-white">登录遇到问题</CardTitle>
          <CardDescription className="text-white/60">
            验证过程中发生了错误
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-white/80">
            {typeof message === 'string' ? message : "未知错误"}
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button asChild className="bg-green-600 hover:bg-green-700 text-white">
            <Link href="/login">返回登录页</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
