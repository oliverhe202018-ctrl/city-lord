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
  const [loginMethod, setLoginMethod] = useState<"password" | "code">("password")
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

      // 如果后端返回了 devCode (开发模式 fallback)，直接提示用户
      if (data.devCode) {
        toast.success("验证码已生成 (开发模式)", { 
          description: `您的验证码是：${data.devCode} (邮件发送可能失败)`,
          duration: 10000, // 显示久一点
          action: {
            label: "填入",
            onClick: () => setVerificationCode(data.devCode)
          }
        })
        // 自动填入（可选，这里为了方便直接填入）
        setVerificationCode(data.devCode)
      } else {
        toast.success("验证码已发送", { description: "请查看您的邮箱 (citylord@126.com 发送)" })
      }
    } catch (error: any) {
      console.error('Send code error:', error)
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
      // 1. 发起 Fetch 请求，而不是提交表单
      const response = await fetch('/api/auth/login-with-code-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          code: verificationCode,
          token: verificationToken // 可选，如果前端有token
        }),
      })

      // 2. 解析响应
      // 注意：如果后端成功，会返回 303 Redirect，fetch 默认会跟随重定向
      // 但如果是 303 跳转到 Magic Link，我们需要拿到那个 URL 吗？
      // 不，我们的 API 设计是：验证成功后，后端生成 magic link 并直接 redirect 浏览器。
      // 但是 fetch 请求如果跟随 redirect，最终会拿到 redirect 后的页面内容（比如首页 HTML）。
      // 这会导致我们在 data 中拿到一堆 HTML，而不是 JSON。
      
      // 修正策略：
      // 我们的后端目前是 `return NextResponse.redirect(actionLink, 303)`。
      // 对于 Fetch 请求，如果设置 `redirect: 'manual'`，我们可以拿到 opaqueredirect，但拿不到 URL。
      // 如果后端返回 JSON { success: true, redirectUrl: '...' } 可能会更好。
      
      // 但是用户要求 "后端 API 格式统一"，且 "验证码错误的时候就直接跳转到...页面显示...Invalid verification code"。
      // 这说明后端目前是在出错时直接渲染了错误信息或者返回了 JSON。
      
      // 如果我们用 fetch，我们需要后端：
      // 1. 出错时返回 JSON (status 400/401)
      // 2. 成功时返回 JSON (status 200)，包含 redirectUrl，由前端进行跳转。
      //    或者成功时保持 Redirect，前端 fetch 会自动跟随，最终 response.ok = true (但 url 变了)。
      
      // 让我们先假设后端会修改为返回 JSON 错误。
      // 如果后端验证成功，它目前是做 303 跳转。
      // Fetch 默认 `redirect: 'follow'`。
      // 如果验证成功，fetch 会跟随跳转到 `/auth/callback` -> `/`。
      // 最终 response.url 会是首页。response.ok 是 true。
      // 这时我们手动 window.location.href = '/' 即可。
      
      // 如果验证失败，后端目前可能返回 JSON { error: ... } (status 500/400)。
      // 这时 response.ok 是 false。我们读取 response.json() 拿到错误信息。

      const contentType = response.headers.get("content-type");
      
      if (!response.ok) {
        let errorMessage = "登录失败";
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
        } else {
            errorMessage = await response.text();
        }
        
        toast.error(errorMessage, { duration: 3000 });
        setLoading(false);
        return;
      }

      // 如果成功，fetch 可能会跟随重定向最终到达首页或其他页面
      // 或者如果后端改成了返回 JSON，我们也处理
      if (contentType && contentType.indexOf("application/json") !== -1) {
          const data = await response.json();
          if (data.redirectUrl) {
              window.location.href = data.redirectUrl;
              return;
          }
      }

      // 如果是重定向跟随成功 (response.ok = true)
      // 我们可以认为登录成功，直接刷新页面或跳转
      toast.success("登录成功！");
      window.location.href = "/";

    } catch (error: any) {
      console.error("[Login Page] Login error:", error)
      toast.error("登录失败", {
        description: error.message || "网络请求失败，请稍后重试"
      })
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
                  {loginMethod === "password" ? "使用账号密码登录游戏" : "使用邮箱验证码登录"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* 登录方式切换 */}
                <div className="flex gap-2 mb-4 p-1 bg-white/5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setLoginMethod("password")}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                      loginMethod === "password"
                        ? "bg-green-600 text-white shadow-lg"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    密码登录
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginMethod("code")}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                      loginMethod === "code"
                        ? "bg-green-600 text-white shadow-lg"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    验证码登录
                  </button>
                </div>

                {/* 密码登录表单 */}
                {loginMethod === "password" && (
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
                )}

                {/* 验证码登录表单 */}
                {loginMethod === "code" && (
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
                      className="w-[120px] bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white"
                      disabled={loading || countdown > 0}
                      onClick={() => handleSendCode('login')}
                    >
                      {countdown > 0 ? `${countdown}s` : "获取验证码"}
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
                )}
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
