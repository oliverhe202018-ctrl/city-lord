"use client"

import { useState, useEffect, Suspense } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, Loader2, Lock, KeyRound, Phone } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Capacitor } from "@capacitor/core"

function LoginPageContent() {
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [codeSent, setCodeSent] = useState(false)
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({})
  const [now, setNow] = useState(Date.now())
  const [loading, setLoading] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [loginMethod, setLoginMethod] = useState<"password" | "code" | "sms">("password")
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Helper for logging events
  const logEvent = (eventName: string, data?: any) => {
    if (typeof window !== 'undefined' && (window as any).Capacitor?.Plugins?.AMapLocation) {
      (window as any).Capacitor.Plugins.AMapLocation.logEvent({ 
        eventName, 
        data: data ? JSON.stringify(data) : undefined 
      });
    }
  };

  useEffect(() => {
    logEvent('login_page_view', { platform: Capacitor.getPlatform() });
  }, []);

  const lobbyId = searchParams.get('lobby')
  const clubId = searchParams.get('club')

  const processAutoJoin = async () => {
    try {
      if (clubId) {
        const { joinClub } = await import('@/app/actions/club')
        await joinClub(clubId)
      }
      if (lobbyId) {
        const { joinRoom } = await import('@/app/actions/room')
        await joinRoom(lobbyId)
      }
    } catch (e) {
      console.error('Auto-join error:', e)
    }
  }

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        window.location.href = "/"
      }
    }
    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        logEvent('login_success', { method: loginMethod });
        await processAutoJoin()
        window.location.href = "/"
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, loginMethod])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('verification_cooldown_v2')
      if (saved) {
        const parsed = JSON.parse(saved)
        const filtered: Record<string, number> = {}
        const currentTime = Date.now()
        Object.entries(parsed).forEach(([key, endAt]) => {
          const timestamp = Number(endAt)
          if (timestamp > currentTime && (timestamp - currentTime < 600000)) {
            filtered[key] = timestamp
          }
        })
        setCooldowns(filtered)
      }
    } catch (e) {
      console.error('Failed to load cooldowns', e)
    }
  }, [])

  useEffect(() => {
    const hasActiveCooldown = Object.values(cooldowns).some(endAt => endAt > Date.now())
    if (!hasActiveCooldown) return

    const timer = setInterval(() => {
      const current = Date.now()
      setNow(current)
    }, 1000)
    
    return () => clearInterval(timer)
  }, [cooldowns])

  const getRemaining = (scene: string, target: string, type: string) => {
    const normalized = target.trim().toLowerCase()
    const key = `cd:${scene}:${type}:${normalized}`
    const endAt = cooldowns[key]
    if (!endAt) return 0
    return Math.max(0, Math.ceil((endAt - now) / 1000))
  }

  const saveCooldown = (scene: string, target: string, type: string, seconds: number) => {
    const normalized = target.trim().toLowerCase()
    const key = `cd:${scene}:${type}:${normalized}`
    const endAt = Date.now() + (seconds * 1000)
    const next = { ...cooldowns, [key]: endAt }
    setCooldowns(next)
    localStorage.setItem('verification_cooldown_v2', JSON.stringify(next))
  }

  const handleSendCode = async (type: 'register' | 'login') => {
    if (!agreed) {
      toast.error("请先阅读并同意以勾选《用户协议》与《隐私政策》")
      return
    }
    if (!email) {
      toast.error("请输入邮箱")
      return
    }
    const remain = getRemaining('email', email, type)
    if (remain > 0) return

    setLoading(true)
    logEvent('auth_code_request', { type, medium: 'email' });
    try {
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
        toast.error(res.message)
        return
      }

      setCodeSent(true)
      saveCooldown('email', email, type, 60)
      toast.success("验证码已发送")
    } catch (error) {
      toast.error("发送失败，请重试")
    } finally {
      setLoading(false)
    }
  }

  const handleLoginVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreed) {
      toast.error("请先阅读并同意以勾选《用户协议》与《隐私政策》")
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: verificationCode,
        type: 'magiclink',
      })
      if (error) throw error
    } catch (error: any) {
      toast.error("验证失败: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    logEvent('login_attempt', { method: 'password' });
    if (!agreed) {
      toast.error("请先阅读并同意以勾选《用户协议》与《隐私政策》")
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } catch (error: any) {
      toast.error("登录失败: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSendSmsCode = async (type: 'register' | 'login') => {
    if (!agreed) {
      toast.error("请先阅读并同意以勾选《用户协议》与《隐私政策》")
      return
    }
    if (!phone) {
      toast.error("请输入手机号")
      return
    }
    const remain = getRemaining('sms', phone, type)
    if (remain > 0) return

    setLoading(true)
    logEvent('auth_code_request', { type, medium: 'sms' });
    try {
      const { sendSmsCode } = await import('@/app/actions/sms-auth')
      const res = await sendSmsCode(phone, type, type === 'register' ? password : undefined)
      if (!res.success) {
        toast.error(res.message)
        return
      }
      setCodeSent(true)
      saveCooldown('sms', phone, type, 60)
      toast.success("验证码已发送")
    } catch (error) {
      toast.error("发送失败")
    } finally {
      setLoading(false)
    }
  }

  const handleSmsLoginVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreed) {
      toast.error("请先阅读并同意以勾选《用户协议》与《隐私政策》")
      return
    }
    setLoading(true)
    try {
      const { verifySmsCode } = await import('@/app/actions/sms-auth')
      const res = await verifySmsCode(phone, verificationCode, 'login', window.location.origin)
      if (!res.success) throw new Error(res.message)
      if (res.tokenHash) {
        await supabase.auth.verifyOtp({ token_hash: res.tokenHash, type: 'magiclink' })
      }
    } catch (error: any) {
      toast.error("验证失败: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRegisterVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreed) {
      toast.error("请先阅读并同意以勾选《用户协议》与《隐私政策》")
      return
    }
    setLoading(true)
    logEvent('register_attempt', { method: 'email' });
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: verificationCode, type: 'signup' })
      if (error) throw error
      logEvent('register_success', { method: 'email' });
    } catch (error: any) {
      toast.error("注册验证失败: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSmsRegisterVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreed) {
      toast.error("请先阅读并同意以勾选《用户协议》与《隐私政策》")
      return
    }
    setLoading(true)
    logEvent('register_attempt', { method: 'sms' });
    try {
      const { verifySmsCode } = await import('@/app/actions/sms-auth')
      const res = await verifySmsCode(phone, verificationCode, 'register')
      if (!res.success) throw new Error(res.message)
      const virtualEmail = `${phone.replace(/\s+/g, '')}@sms.citylord.local`
      const { error } = await supabase.auth.signInWithPassword({ email: virtualEmail, password })
      if (error) throw error
      logEvent('register_success', { method: 'sms' });
    } catch (error: any) {
      toast.error("注册验证失败: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  const AgreementBox = ({ id }: { id: string }) => (
    <div className="flex items-center justify-center space-x-2 py-2 mt-4 opacity-80">
      <Checkbox
        id={id}
        checked={agreed}
        onCheckedChange={(checked) => setAgreed(checked as boolean)}
        className="h-3.5 w-3.5 border-white/40 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
      />
      <Label htmlFor={id} className="text-[10px] text-white/60">
        我已阅读并同意
        <Link href="/terms" className="text-green-400 hover:text-green-300 ml-0.5">《用户协议》</Link>
        和
        <Link href="/privacy" className="text-green-400 hover:text-green-300 ml-0.5">《隐私政策》</Link>
      </Label>
    </div>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0f1a] p-4 relative overflow-hidden">
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

        <Tabs defaultValue="login" className="w-full space-y-4">
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
                  {loginMethod === "password" ? "使用账号密码登录游戏" : loginMethod === "code" ? "使用邮箱验证码登录" : "使用短信验证码登录"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4 p-1 bg-white/5 rounded-lg">
                  {(['password', 'code', 'sms'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setLoginMethod(m)}
                      className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${loginMethod === m ? "bg-green-600 text-white shadow-lg" : "text-white/60 hover:text-white hover:bg-white/5"}`}
                    >
                      {m === 'password' ? '密码' : m === 'code' ? '邮箱码' : '短信'}
                    </button>
                  ))}
                </div>

                {loginMethod === "password" && (
                  <form onSubmit={handlePasswordLogin} className="space-y-4">
                    <div className="space-y-2">
                       <div className="relative"><Mail className="absolute left-3 top-3 h-4 w-4 text-white/40" /><Input type="email" placeholder="邮箱" value={email} onChange={e => setEmail(e.target.value)} className="pl-10 bg-white/5 border-white/10 text-white" required /></div>
                       <div className="relative"><Lock className="absolute left-3 top-3 h-4 w-4 text-white/40" /><Input type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)} className="pl-10 bg-white/5 border-white/10 text-white" required /></div>
                    </div>
                    <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : "登录"}</Button>
                    <AgreementBox id="terms-pass" />
                    <div className="text-center mt-2 font-mono"><Link href="/reset-password" onClick={() => logEvent('forgot_password_click')} className="text-[10px] text-green-400 hover:underline">忘记密码？</Link></div>
                  </form>
                )}

                {loginMethod === "code" && (
                  <form onSubmit={handleLoginVerify} className="space-y-4">
                    <div className="space-y-2">
                      <div className="relative"><Mail className="absolute left-3 top-3 h-4 w-4 text-white/40" /><Input type="email" placeholder="邮箱" value={email} onChange={e => setEmail(e.target.value)} className="pl-10 bg-white/5 border-white/10 text-white" required /></div>
                      <div className="flex gap-2">
                        <div className="relative flex-1"><KeyRound className="absolute left-3 top-3 h-4 w-4 text-white/40" /><Input type="text" placeholder="码" value={verificationCode} onChange={e => setVerificationCode(e.target.value)} className="pl-10 bg-white/5 border-white/10 text-white" required maxLength={6} /></div>
                        <Button type="button" variant="outline" className="w-24 bg-white/5 border-white/10 text-white" disabled={loading || getRemaining('email', email, 'login') > 0} onClick={() => handleSendCode('login')}>
                          {getRemaining('email', email, 'login') > 0 ? `${getRemaining('email', email, 'login')}s` : "获取"}
                        </Button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : "登录"}</Button>
                    <AgreementBox id="terms-code" />
                  </form>
                )}

                {loginMethod === "sms" && (
                  <form onSubmit={handleSmsLoginVerify} className="space-y-4">
                    <div className="space-y-2">
                      <div className="relative"><Phone className="absolute left-3 top-3 h-4 w-4 text-white/40" /><Input type="tel" placeholder="手机号" value={phone} onChange={e => setPhone(e.target.value)} className="pl-10 bg-white/5 border-white/10 text-white" required maxLength={11} /></div>
                      <div className="flex gap-2">
                        <div className="relative flex-1"><KeyRound className="absolute left-3 top-3 h-4 w-4 text-white/40" /><Input type="text" placeholder="码" value={verificationCode} onChange={e => setVerificationCode(e.target.value)} className="pl-10 bg-white/5 border-white/10 text-white" required maxLength={6} /></div>
                        <Button type="button" variant="outline" className="w-24 bg-white/5 border-white/10 text-white" disabled={loading || getRemaining('sms', phone, 'login') > 0} onClick={() => handleSendSmsCode('login')}>
                          {getRemaining('sms', phone, 'login') > 0 ? `${getRemaining('sms', phone, 'login')}s` : "获取"}
                        </Button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : "登录"}</Button>
                    <AgreementBox id="terms-sms" />
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="register">
            <Card className="border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl">
              <CardHeader><CardTitle className="text-xl text-white">邮箱注册</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleRegisterVerify} className="space-y-4">
                  <div className="space-y-2">
                    <div className="relative"><Mail className="absolute left-3 top-3 h-4 w-4 text-white/40" /><Input type="email" placeholder="邮箱" value={email} onChange={e => setEmail(e.target.value)} className="pl-10 bg-white/5 border-white/10 text-white" required /></div>
                    <div className="flex gap-2">
                      <div className="relative flex-1"><KeyRound className="absolute left-3 top-3 h-4 w-4 text-white/40" /><Input type="text" placeholder="码" value={verificationCode} onChange={e => setVerificationCode(e.target.value)} className="pl-10 bg-white/5 border-white/10 text-white" required maxLength={6} /></div>
                      <Button type="button" variant="outline" onClick={() => handleSendCode('register')} disabled={loading || getRemaining('email', email, 'register') > 0 || !email} className="w-24 bg-white/5 border-white/10 text-white">
                        {getRemaining('email', email, 'register') > 0 ? `${getRemaining('email', email, 'register')}s` : "获取"}
                      </Button>
                    </div>
                    <div className="relative"><Lock className="absolute left-3 top-3 h-4 w-4 text-white/40" /><Input type="password" placeholder="设置密码" value={password} onChange={e => setPassword(e.target.value)} className="pl-10 bg-white/5 border-white/10 text-white" required minLength={6} /></div>
                  </div>
                  <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white" disabled={loading}>注册并登录</Button>
                  <AgreementBox id="terms-reg" />
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sms-register">
            <Card className="border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl">
              <CardHeader><CardTitle className="text-xl text-white">手机注册</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleSmsRegisterVerify} className="space-y-4">
                  <div className="space-y-2">
                    <div className="relative"><Phone className="absolute left-3 top-3 h-4 w-4 text-white/40" /><Input type="tel" placeholder="手机号" value={phone} onChange={e => setPhone(e.target.value)} className="pl-10 bg-white/5 border-white/10 text-white" required maxLength={11} /></div>
                    <div className="flex gap-2">
                      <div className="relative flex-1"><KeyRound className="absolute left-3 top-3 h-4 w-4 text-white/40" /><Input type="text" placeholder="码" value={verificationCode} onChange={e => setVerificationCode(e.target.value)} className="pl-10 bg-white/5 border-white/10 text-white" required maxLength={6} /></div>
                      <Button type="button" variant="outline" onClick={() => handleSendSmsCode('register')} disabled={loading || getRemaining('sms', phone, 'register') > 0 || !phone} className="w-24 bg-white/5 border-white/10 text-white">
                        {getRemaining('sms', phone, 'register') > 0 ? `${getRemaining('sms', phone, 'register')}s` : "获取"}
                      </Button>
                    </div>
                    <div className="relative"><Lock className="absolute left-3 top-3 h-4 w-4 text-white/40" /><Input type="password" placeholder="设置密码" value={password} onChange={e => setPassword(e.target.value)} className="pl-10 bg-white/5 border-white/10 text-white" required minLength={6} /></div>
                  </div>
                  <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white" disabled={loading}>注册并登录</Button>
                  <AgreementBox id="terms-sms-reg" />
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#0a0f1a]">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  )
}
