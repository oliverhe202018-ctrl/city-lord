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
  // verificationToken is no longer needed with Supabase SDK
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

  // ==========================================
  // 核心逻辑: 发送验证码 (Register & Login)
  // ==========================================
  const handleSendCode = async (type: 'register' | 'login') => {
    if (!email) {
      toast.error("请输入邮箱")
      return
    }
    if (countdown > 0) return

    setLoading(true)
    try {
      if (type === 'register') {
        // [Register Logic]
        // 1. Strict Requirement: Call signUp only
        if (!password) {
           toast.error("请先输入密码")
           setLoading(false)
           return
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        })

        // 2. Intercept "User already registered" error
        if (error) {
          if (error.message.includes("already registered") || error.status === 422) { 
             toast.error("该账号已存在，请直接登录")
             return // Stop flow
          }
          throw error
        }
        
        // 3. Handle "Prevent User Enumeration" fake success
        // If identities is empty/null, it means the user exists but Supabase hid the error
        if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
            toast.error("该账号已存在，请直接登录")
            return // Stop flow
        }

        // Success: Only now start countdown
        setCodeSent(true)
        setCountdown(60)
        toast.success("验证码已发送", { description: "请查看您的邮箱" })

      } else {
        // [Login Logic]
        // 1. Strict Requirement: Call signInWithOtp with shouldCreateUser: false
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: false, // Prevent new users from getting code here
          },
        })

        if (error) {
           if (error.message.includes("Signups not allowed") || error.message.includes("not found")) {
              toast.error("账号未注册，请先注册")
              return
           }
           throw error
        }

        setCodeSent(true)
        setCountdown(60)
        toast.success("验证码已发送", { description: "请登录邮箱查看" })
      }
    } catch (error: any) {
      console.error('Send code error:', error)
      let msg = error?.message
      if (msg?.includes("already registered")) msg = "该账号已存在，请直接登录"
      if (msg?.includes("Signups not allowed")) msg = "账号未注册，请先注册"
      
      toast.error("发送失败", { description: msg ?? "请检查网络或稍后再试" })
    } finally {
      setLoading(false)
    }
  }

  // ==========================================
  // 核心逻辑: 验证验证码 (Register Final Step)
  // ==========================================
  const handleRegisterVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !verificationCode) return

    setLoading(true)
    try {
      // [注册验证]
      // 必须使用 type: 'signup'
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: verificationCode,
        type: 'signup',
      })

      if (error) throw error

      toast.success("注册成功", { description: "欢迎加入城市领主" })
      // Session 建立后，useEffect 会自动跳转
    } catch (error: any) {
      console.error('Register verify error:', error)
      toast.error("注册验证失败", { description: error.message || "验证码错误" })
    } finally {
      setLoading(false)
    }
  }

  // ==========================================
  // 核心逻辑: 验证验证码 (Login Final Step)
  // ==========================================
  const handleLoginVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !verificationCode) return

    setLoading(true)
    try {
      // [登录验证]
      // 必须使用 type: 'email' (Magic Link / OTP 登录)
      // 注意：signInWithOtp 发送的是 magiclink 或 recovery 或 otp，
      // 对于 type，通常是 'email' 或 'magiclink'，这里 verifyOtp 文档推荐 'email' 对应 signInWithOtp
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: verificationCode,
        type: 'email', 
      })

      if (error) throw error

      toast.success("登录成功")
    } catch (error: any) {
      console.error('Login verify error:', error)
      toast.error("登录失败", { description: error.message || "验证码错误" })
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      const error = response?.error

      if (error) {
        throw error
      }

      toast.success("登录成功")
      
      // 强制重定向，确保状态同步
      window.location.href = "/"
    } catch (error: any) {
      console.error("Login error:", error)
      toast.error("登录失败", {
        description: error?.message ?? "登录失败，请检查网络"
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
                  <form onSubmit={handleLoginVerify} className="space-y-4">
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
                <form onSubmit={handleRegisterVerify} className="space-y-4">
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
