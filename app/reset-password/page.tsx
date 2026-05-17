"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Mail, Loader2, Lock, KeyRound, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export default function ResetPasswordPage() {
    const [email, setEmail] = useState("")
    const [verificationCode, setVerificationCode] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [codeSent, setCodeSent] = useState(false)
    const [countdown, setCountdown] = useState(0)
    const [loading, setLoading] = useState(false)
    const [step, setStep] = useState<"email" | "verify" | "success">("email")
    const router = useRouter()
    const supabase = createClient()

    // Countdown timer
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
            return () => clearTimeout(timer)
        }
    }, [countdown])

    // Step 1: Send reset verification code
    const handleSendCode = async () => {
        if (!email) {
            toast.error("请输入邮箱")
            return
        }
        if (countdown > 0) return

        setLoading(true)
        try {
            const { sendResetPasswordCode } = await import('@/app/actions/auth')
            const res = await sendResetPasswordCode(email)

            if (!res.success) {
                toast.error(res.message, { description: res.error })
                return
            }

            setCodeSent(true)
            setCountdown(60)
            setStep("verify")
            toast.success("重置验证码已发送", { description: "请查看您的邮箱 (注意检查垃圾箱)" })
        } catch (error: any) {
            console.error('Send reset code error:', error)
            toast.error("发送异常", { description: "服务连接失败，请检查网络" })
        } finally {
            setLoading(false)
        }
    }

    // Step 2: Verify code and set new password
    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!verificationCode || verificationCode.length !== 6) {
            toast.error("请输入6位验证码")
            return
        }

        if (!newPassword || newPassword.length < 6) {
            toast.error("密码长度至少6位")
            return
        }

        if (newPassword !== confirmPassword) {
            toast.error("两次输入的密码不一致")
            return
        }

        setLoading(true)
        try {
            // Verify the recovery OTP to establish session
            const { data, error } = await supabase.auth.verifyOtp({
                email,
                token: verificationCode,
                type: 'recovery',
            })

            if (error) {
                toast.error("验证码错误或已过期", { description: error.message })
                return
            }

            // Now update the password (user is authenticated via recovery token)
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword,
            })

            if (updateError) {
                toast.error("密码重置失败", { description: updateError.message })
                return
            }

            // Sign out after password change so user logs in fresh
            await supabase.auth.signOut()

            setStep("success")
            toast.success("密码重置成功")
        } catch (error: any) {
            console.error('Reset password error:', error)
            toast.error("重置失败", { description: error.message || "请稍后再试" })
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
                {/* Back button */}
                <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-white/50 hover:text-white/80 mb-6 text-sm transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    返回登录
                </Link>

                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-600 mb-2 font-mono tracking-tighter">
                        城市领主
                    </h1>
                    <p className="text-white/60 text-sm">重置密码</p>
                </div>

                <Card className="border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl">
                    <CardHeader>
                        <CardTitle className="text-xl text-white">
                            {step === "email" && "找回密码"}
                            {step === "verify" && "验证并重置"}
                            {step === "success" && "重置成功"}
                        </CardTitle>
                        <CardDescription className="text-white/40">
                            {step === "email" && "输入注册邮箱，我们将发送验证码"}
                            {step === "verify" && `验证码已发送至 ${email}`}
                            {step === "success" && "您的密码已成功重置"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {/* Step 1: Enter Email */}
                        {step === "email" && (
                            <div className="space-y-4">
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-white/40" />
                                    <Input
                                        type="email"
                                        name="account_id"
                                        autoComplete="off"
                                        placeholder="注册邮箱地址"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-green-500/50"
                                        required
                                        onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
                                    />
                                </div>
                                <Button
                                    onClick={handleSendCode}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                                    disabled={loading || !email}
                                >
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    发送验证码
                                </Button>
                            </div>
                        )}

                        {/* Step 2: Verify Code + New Password */}
                        {step === "verify" && (
                            <form onSubmit={handleResetPassword} className="space-y-4" autoComplete="off">
                                <div className="space-y-3">
                                    {/* Verification Code */}
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <KeyRound className="absolute left-3 top-3 h-4 w-4 text-white/40" />
                                            <Input
                                                type="text"
                                                placeholder="6位验证码"
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
                                            className="w-[100px] bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white"
                                            disabled={loading || countdown > 0}
                                            onClick={handleSendCode}
                                        >
                                            {countdown > 0 ? `${countdown}s` : "重新发送"}
                                        </Button>
                                    </div>

                                    {/* New Password */}
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 h-4 w-4 text-white/40" />
                                        <Input
                                            type="password"
                                            name="account_secret"
                                            autoComplete="new-password"
                                            placeholder="新密码 (至少6位)"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-green-500/50"
                                            required
                                            minLength={6}
                                        />
                                    </div>

                                    {/* Confirm Password */}
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 h-4 w-4 text-white/40" />
                                        <Input
                                            type="password"
                                            name="account_secret"
                                            autoComplete="new-password"
                                            placeholder="确认新密码"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
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
                                    重置密码
                                </Button>

                                <button
                                    type="button"
                                    onClick={() => { setStep("email"); setCodeSent(false) }}
                                    className="w-full text-center text-sm text-white/40 hover:text-white/60 transition-colors"
                                >
                                    更换邮箱
                                </button>
                            </form>
                        )}

                        {/* Step 3: Success */}
                        {step === "success" && (
                            <div className="flex flex-col items-center gap-4 py-4">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 border border-green-500/30">
                                    <CheckCircle2 className="h-8 w-8 text-green-400" />
                                </div>
                                <p className="text-white/60 text-sm text-center">
                                    您的密码已成功重置，请使用新密码登录
                                </p>
                                <Button
                                    onClick={() => router.push('/login')}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                                >
                                    去登录
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
