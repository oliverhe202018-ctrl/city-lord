"use client"

import { useState, useEffect } from "react"
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
  const [verificationCode, setVerificationCode] = useState("")
  const [verificationToken, setVerificationToken] = useState("")
  const [codeSent, setCodeSent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // 检查登录状态，如果已登录则自动跳转
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        toast.success("您已登录，正在跳转...")
        window.location.href = "/"
      }
    }
    
    checkSession()

    // 监听 Auth 状态变化 (例如 Magic Link 完成后)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        toast.success("登录成功")
        // 使用 window.location.href 确保完全重载
        window.location.href = "/"
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router, supabase])

  // Countdown timer for verification code
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleSendCode = async (type: 'register' | 'login' = 'register') => {
    if (!email) {
      toast.error("请输入邮箱")
      return
    }
    if (countdown > 0) return

    setLoading(true)
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type })
      })
      
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error || '发送失败')
      
      setVerificationToken(data.token)
      setCodeSent(true)
      setCountdown(60) // 60s cooldown
      toast.success("验证码已发送", { description: "请查看您的邮箱 (citylord@126.com 发送)" })
    } catch (error: any) {
      toast.error("发送失败", { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || !verificationCode) {
      toast.error("请填写完整信息")
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          password, 
          code: verificationCode, 
          token: verificationToken 
        })
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || '注册失败')

      if (data.requiresEmailConfirmation) {
        toast.success("注册成功！", { 
          description: "账号已创建。由于 Supabase 项目开启了邮箱验证，请前往邮箱点击确认链接以激活账户，或者在 Supabase 后台关闭 'Confirm email' 选项。",
          duration: 8000
        })
      } else {
        toast.success("注册成功", { description: "正在登录..." })
        // Use router.push first, then fallback to window.location
        // window.location is safer for full reload to ensure auth state sync
        window.location.href = "/"
      }
    } catch (error: any) {
      toast.error("注册失败", { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleCodeLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !verificationCode) {
      toast.error("请输入邮箱和验证码")
      return
    }

    setLoading(true)
    try {
      // 1. Verify code on server and get Supabase Magic Link token
      const res = await fetch('/api/auth/login-with-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          code: verificationCode, 
          token: verificationToken 
        })
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || '验证失败')

      // 2. Use the token to sign in via Supabase
      // Check if it's a token_hash (PKCE) or a raw token
      let authResult;
      
      // If the API explicitly returned a type (email vs magiclink), use it
      // Otherwise fallback to isHash logic
      const verifyType = data.type || (data.isHash ? 'email' : 'magiclink');

      console.log('Verifying OTP with:', { 
        email, 
        token: data.token, 
        type: verifyType,
        isHash: data.isHash 
      });

      if (verifyType === 'recovery') {
        // Recovery type (Password Reset) - extremely robust for force-login
        authResult = await supabase.auth.verifyOtp({
          email,
          token: data.token,
          type: 'recovery'
        })
      } else if (verifyType === 'email') {
        // For PKCE token_hash, we use type: 'email'
        authResult = await supabase.auth.verifyOtp({
          email,
          token_hash: data.token,
          type: 'email'
        })
      } else {
        // Classic magic link token
        authResult = await supabase.auth.verifyOtp({
          email,
          token: data.token,
          type: 'magiclink'
        })
      }

      const { error: authError } = authResult;

      if (authError) throw authError

      toast.success("登录成功", { description: "正在跳转..." })
      window.location.href = "/"

    } catch (error: any) {
      console.error("Login error:", error)
      toast.error("登录失败", {
        description: error.message || "请稍后重试"
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
      
      // 强制重定向，确保状态同步
      window.location.href = "/"
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
    <div className="flex min-h-screen items-center justify-center bg-[#0a0f1a] p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-green-500/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-blue-500/10 rounded-full blur-[128px]" />
      </div>

      <div className="w-full max-w-md animate-in fade-in zoom-in duration-500 z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-600 mb-2 font-mono tracking-tighter">
            城市领主
          </h1>
          <p className="text-white/60 text-sm">用脚步丈量城市，用汗水铸就领地</p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4 bg-black/40 border border-white/10">
            <TabsTrigger value="login">登录</TabsTrigger>
            <TabsTrigger value="register">注册</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card className="border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl">
              <CardHeader>
                <CardTitle className="text-xl text-white">欢迎回来</CardTitle>
                <CardDescription className="text-white/40">
                  选择登录方式进入游戏
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="password" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4 bg-white/5">
                    <TabsTrigger value="password">密码登录</TabsTrigger>
                    <TabsTrigger value="magic">验证码登录</TabsTrigger>
                  </TabsList>

                  <TabsContent value="password">
                    <form onSubmit={handlePasswordLogin} className="space-y-4">
                      <div className="space-y-2">
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-white/40" />
                          <Input
                            type="email"
                            placeholder="邮箱地址"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-green-500/50"
                            required
                          />
                        </div>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-white/40" />
                          <Input
                            type="password"
                            placeholder="密码"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-green-500/50"
                            required
                          />
                        </div>
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        disabled={loading}
                      >
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        登录
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="magic">
                    <form onSubmit={handleCodeLogin} className="space-y-4">
                      <div className="space-y-2">
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-white/40" />
                          <Input
                            type="email"
                            placeholder="邮箱地址"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-green-500/50"
                            required
                          />
                        </div>

                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <KeyRound className="absolute left-3 top-3 h-4 w-4 text-white/40" />
                            <Input
                              type="text"
                              placeholder="验证码"
                              value={verificationCode}
                              onChange={(e) => setVerificationCode(e.target.value)}
                              className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-green-500/50"
                              required
                              maxLength={6}
                            />
                          </div>
                          <Button 
                            type="button"
                            variant="outline"
                            onClick={() => handleSendCode('login')}
                            disabled={loading || countdown > 0 || !email}
                            className="w-24 border-white/10 bg-white/5 text-white hover:bg-white/20 hover:text-white disabled:opacity-50"
                          >
                            {countdown > 0 ? `${countdown}s` : (loading && !codeSent ? <Loader2 className="h-4 w-4 animate-spin" /> : "获取")}
                          </Button>
                        </div>
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        disabled={loading}
                      >
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        登录
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="register">
            <Card className="border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl">
              <CardHeader>
                <CardTitle className="text-xl text-white">注册账号</CardTitle>
                <CardDescription className="text-white/40">
                  使用邮箱验证码注册
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-white/40" />
                      <Input
                        type="email"
                        placeholder="邮箱地址"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-green-500/50"
                        required
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <KeyRound className="absolute left-3 top-3 h-4 w-4 text-white/40" />
                        <Input
                          type="text"
                          placeholder="验证码"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value)}
                          className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-green-500/50"
                          required
                          maxLength={6}
                        />
                      </div>
                      <Button 
                        type="button"
                        variant="outline"
                        onClick={() => handleSendCode('register')}
                        disabled={loading || countdown > 0 || !email}
                        className="w-24 border-white/10 bg-white/5 text-white hover:bg-white/20 hover:text-white disabled:opacity-50"
                      >
                        {countdown > 0 ? `${countdown}s` : (loading && !codeSent ? <Loader2 className="h-4 w-4 animate-spin" /> : "获取")}
                      </Button>
                    </div>

                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-white/40" />
                      <Input
                        type="password"
                        placeholder="设置密码"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-green-500/50"
                        required
                        minLength={6}
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    注册并登录
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
