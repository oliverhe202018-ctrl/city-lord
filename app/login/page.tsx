"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Mail, Loader2, Lock, KeyRound, Phone } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  // verificationToken is no longer needed with Supabase SDK
  const [codeSent, setCodeSent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [loginMethod, setLoginMethod] = useState<"password" | "code" | "sms">("password")
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
      // Server Action 调用
      const { sendAuthCode } = await import('@/app/actions/auth')

      let res
      if (type === 'register') {
        if (!password) {
          toast.error("请先输入密码")
          setLoading(false)
          return
        }
        res = await sendAuthCode(email, 'register', password)
      } else {
        res = await sendAuthCode(email, 'login')
      }

      if (!res.success) {
        toast.error(res.message, { description: res.error })
        return
      }

      // Success
      setCodeSent(true)
      setCountdown(60)
      toast.success("验证码已发送", { description: "请查看您的邮箱 (注意检查垃圾箱)" })

    } catch (error: any) {
      console.error('Send code error:', error)
      toast.error("发送异常", { description: "服务连接失败，请检查网络" })
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
      // 对应 Admin generateLink type: 'signup'
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
      toast.error("注册验证失败", { description: error.message || "验证码错误或已失效" })
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
      // 对应 Admin generateLink type: 'magiclink'
      // 注意：这里必须使用 'magiclink' (或 'recovery')，取决于 generateLink 的 type
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: verificationCode,
        type: 'magiclink',
      })

      if (error) throw error

      toast.success("登录成功")
    } catch (error: any) {
      console.error('Login verify error:', error)
      // 尝试降级：如果 magiclink 失败，尝试 email 类型 (兼容旧数据)
      try {
        const retry = await supabase.auth.verifyOtp({
          email,
          token: verificationCode,
          type: 'email',
        })
        if (retry.error) throw retry.error
        toast.success("登录成功")
      } catch (retryError) {
        toast.error("登录失败", { description: error.message || "验证码错误或已失效" })
      }
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

  // ==========================================
  // 核心逻辑: 发送短信验证码
  // ==========================================
  const handleSendSmsCode = async (type: 'register' | 'login') => {
    if (!phone) {
      toast.error("请输入手机号")
      return
    }
    if (countdown > 0) return

    setLoading(true)
    try {
      const { sendSmsCode } = await import('@/app/actions/sms-auth')
      const res = await sendSmsCode(phone, type, type === 'register' ? password : undefined)

      if (!res.success) {
        toast.error(res.message, { description: res.error })
        return
      }

      setCodeSent(true)
      setCountdown(60)
      toast.success("验证码已发送", { description: "请查看您的手机短信" })
    } catch (error: any) {
      console.error('Send SMS code error:', error)
      toast.error("发送异常", { description: "服务连接失败，请检查网络" })
    } finally {
      setLoading(false)
    }
  }

  // ==========================================
  // 核心逻辑: 验证短信验证码 (Login)
  // ==========================================
  const handleSmsLoginVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone || !verificationCode) return

    setLoading(true)
    try {
      const { verifySmsCode } = await import('@/app/actions/sms-auth')
      const res = await verifySmsCode(phone, verificationCode, 'login')

      if (!res.success) {
        toast.error(res.message, { description: res.error })
        return
      }

      // Sign in with the virtual email and trigger session
      const virtualEmail = `${phone.replace(/\s+/g, '')}@sms.citylord.local`
      const { error } = await supabase.auth.signInWithOtp({ email: virtualEmail })
      if (error) {
        // Fallback: try signing in with the magiclink type
        const verifyRes = await supabase.auth.verifyOtp({
          email: virtualEmail,
          token: verificationCode,
          type: 'magiclink',
        })
        if (verifyRes.error) {
          toast.error("登录失败", { description: "请检查验证码是否正确" })
          return
        }
      }

      toast.success("登录成功")
    } catch (error: any) {
      console.error('SMS login verify error:', error)
      toast.error("验证失败", { description: error.message || "请稍后再试" })
    } finally {
      setLoading(false)
    }
  }

  // ==========================================
  // 核心逻辑: 验证短信验证码 (Register)
  // ==========================================
  const handleSmsRegisterVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone || !verificationCode || !password) return

    setLoading(true)
    try {
      const { verifySmsCode } = await import('@/app/actions/sms-auth')
      const res = await verifySmsCode(phone, verificationCode, 'register')

      if (!res.success) {
        toast.error(res.message, { description: res.error })
        return
      }

      // Sign in with the virtual email and password
      const virtualEmail = `${phone.replace(/\s+/g, '')}@sms.citylord.local`
      const { error } = await supabase.auth.signInWithPassword({
        email: virtualEmail,
        password,
      })

      if (error) throw error

      toast.success("注册成功", { description: "欢迎加入城市领主" })
    } catch (error: any) {
      console.error('SMS register verify error:', error)
      toast.error("注册验证失败", { description: error.message || "验证码错误或已失效" })
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
          <TabsList className="grid w-full grid-cols-3 mb-4 bg-black/40 border border-white/10">
            <TabsTrigger value="login">登录</TabsTrigger>
            <TabsTrigger value="register">邮箱注册</TabsTrigger>
            <TabsTrigger value="sms-register">手机注册</TabsTrigger>
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
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${loginMethod === "password"
                      ? "bg-green-600 text-white shadow-lg"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                      }`}
                  >
                    密码登录
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginMethod("code")}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${loginMethod === "code"
                      ? "bg-green-600 text-white shadow-lg"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                      }`}
                  >
                    邮箱验证码
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginMethod("sms")}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${loginMethod === "sms"
                      ? "bg-green-600 text-white shadow-lg"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                      }`}
                  >
                    短信登录
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

                {/* 短信验证码登录表单 */}
                {loginMethod === "sms" && (
                  <form onSubmit={handleSmsLoginVerify} className="space-y-4">
                    <div className="space-y-2">
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-white/40" />
                        <Input
                          type="tel"
                          placeholder="手机号码"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-green-500/50"
                          required
                          maxLength={11}
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
                          onClick={() => handleSendSmsCode('login')}
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

          <TabsContent value="sms-register">
            <Card className="border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl">
              <CardHeader>
                <CardTitle className="text-xl text-white">手机号注册</CardTitle>
                <CardDescription className="text-white/40">
                  使用手机短信验证码注册
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSmsRegisterVerify} className="space-y-4">
                  <div className="space-y-2">
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-white/40" />
                      <Input
                        type="tel"
                        placeholder="手机号码"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-green-500/50"
                        required
                        maxLength={11}
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
                        onClick={() => handleSendSmsCode('register')}
                        disabled={loading || countdown > 0 || !phone}
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
