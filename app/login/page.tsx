"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Mail, Loader2, Lock, KeyRound } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${location.origin}/auth/callback`,
        },
      })

      if (error) {
        throw error
      }

      setSubmitted(true)
      toast.success("登录链接已发送", {
        description: "请前往邮箱点击链接完成登录"
      })
    } catch (error) {
      console.error("Login error:", error)
      toast.error("发送失败", {
        description: error instanceof Error ? error.message : "请稍后重试"
      })
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw error
      }

      toast.success("登录成功")
      router.push("/")
      router.refresh()
    } catch (error) {
      console.error("Login error:", error)
      toast.error("登录失败", {
        description: error instanceof Error ? error.message : "账号或密码错误"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#0f172a] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <Link 
          href="/" 
          className="inline-flex items-center text-sm text-white/60 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回游戏
        </Link>
        
        <Card className="bg-black/40 border-white/10 backdrop-blur-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-white text-center">登录 CityLord</CardTitle>
            <CardDescription className="text-center text-white/60">
              选择您喜欢的登录方式
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="magic-link" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-white/5 mb-4">
                <TabsTrigger value="magic-link">邮箱链接</TabsTrigger>
                <TabsTrigger value="password">账号密码</TabsTrigger>
              </TabsList>

              <TabsContent value="magic-link">
                {submitted ? (
                  <div className="text-center space-y-4 py-4 animate-in fade-in zoom-in duration-300">
                    <div className="mx-auto w-12 h-12 bg-[#39ff14]/20 rounded-full flex items-center justify-center">
                      <Mail className="w-6 h-6 text-[#39ff14]" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-medium text-white">邮件已发送</h3>
                      <p className="text-sm text-white/60">
                        请检查您的邮箱 {email}
                        <br />
                        点击邮件中的链接即可登录
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full border-white/10 text-white hover:bg-white/5 hover:text-white"
                      onClick={() => setSubmitted(false)}
                    >
                      使用其他邮箱
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleMagicLinkLogin} className="space-y-4">
                    <div className="space-y-2">
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-white/40" />
                        <Input
                          type="email"
                          placeholder="name@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-[#39ff14]/50 focus:ring-[#39ff14]/20"
                        />
                      </div>
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full bg-[#39ff14] text-black hover:bg-[#39ff14]/90 font-bold"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          发送中...
                        </>
                      ) : (
                        "发送登录链接"
                      )}
                    </Button>
                  </form>
                )}
              </TabsContent>

              <TabsContent value="password">
                <form onSubmit={handlePasswordLogin} className="space-y-4">
                  <div className="space-y-2">
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-white/40" />
                      <Input
                        type="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-cyan-400/50 focus:ring-cyan-400/20"
                      />
                    </div>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-3 h-4 w-4 text-white/40" />
                      <Input
                        type="password"
                        placeholder="请输入密码"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-cyan-400/50 focus:ring-cyan-400/20"
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-cyan-400 text-black hover:bg-cyan-400/90 font-bold"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        登录中...
                      </>
                    ) : (
                      "登录"
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
