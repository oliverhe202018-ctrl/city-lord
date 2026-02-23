"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Mail, Phone, Shield, ChevronRight, Loader2, Check, KeyRound } from "lucide-react"

interface AccountManagerProps {
    userId: string
}

export function AccountManager({ userId }: AccountManagerProps) {
    const [email, setEmail] = useState<string | null>(null)
    const [phone, setPhone] = useState<string | null>(null)
    const [emailVerified, setEmailVerified] = useState(false)
    const [phoneVerified, setPhoneVerified] = useState(false)
    const [isVirtualEmail, setIsVirtualEmail] = useState(false)
    const [loading, setLoading] = useState(true)

    // Bind phone states
    const [showPhoneBind, setShowPhoneBind] = useState(false)
    const [phoneInput, setPhoneInput] = useState("")
    const [phoneCode, setPhoneCode] = useState("")
    const [phoneCodeSent, setPhoneCodeSent] = useState(false)
    const [phoneCountdown, setPhoneCountdown] = useState(0)
    const [phoneSending, setPhoneSending] = useState(false)
    const [phoneVerifying, setPhoneVerifying] = useState(false)

    // Bind email states
    const [showEmailBind, setShowEmailBind] = useState(false)
    const [emailInput, setEmailInput] = useState("")
    const [emailCode, setEmailCode] = useState("")
    const [emailCodeSent, setEmailCodeSent] = useState(false)
    const [emailCountdown, setEmailCountdown] = useState(0)
    const [emailSending, setEmailSending] = useState(false)
    const [emailVerifying, setEmailVerifying] = useState(false)

    // Fetch account info
    useEffect(() => {
        const fetchInfo = async () => {
            try {
                const { getAccountInfo } = await import("@/app/actions/account")
                const res = await getAccountInfo()
                if (res.success && res.data) {
                    setEmail(res.data.email)
                    setPhone(res.data.phone)
                    setEmailVerified(res.data.emailVerified)
                    setPhoneVerified(res.data.phoneVerified)
                    setIsVirtualEmail(res.data.isVirtualEmail)
                }
            } catch (e) {
                console.error("Failed to fetch account info:", e)
            } finally {
                setLoading(false)
            }
        }
        if (userId) fetchInfo()
    }, [userId])

    // Countdown timers
    useEffect(() => {
        if (phoneCountdown > 0) {
            const timer = setTimeout(() => setPhoneCountdown(phoneCountdown - 1), 1000)
            return () => clearTimeout(timer)
        }
    }, [phoneCountdown])

    useEffect(() => {
        if (emailCountdown > 0) {
            const timer = setTimeout(() => setEmailCountdown(emailCountdown - 1), 1000)
            return () => clearTimeout(timer)
        }
    }, [emailCountdown])

    // Phone bind handlers
    const handleSendPhoneCode = async () => {
        if (!phoneInput || phoneCountdown > 0) return
        setPhoneSending(true)
        try {
            const { sendPhoneBindCode } = await import("@/app/actions/account")
            const res = await sendPhoneBindCode(phoneInput)
            if (!res.success) {
                toast.error(res.message)
                return
            }
            setPhoneCodeSent(true)
            setPhoneCountdown(60)
            toast.success("验证码已发送")
        } catch (e: any) {
            toast.error("发送失败", { description: e.message })
        } finally {
            setPhoneSending(false)
        }
    }

    const handleVerifyPhone = async () => {
        if (!phoneInput || !phoneCode) return
        setPhoneVerifying(true)
        try {
            const { verifyPhoneBindCode } = await import("@/app/actions/account")
            const res = await verifyPhoneBindCode(phoneInput, phoneCode)
            if (!res.success) {
                toast.error(res.message)
                return
            }
            toast.success("手机号绑定成功")
            setPhone(phoneInput)
            setPhoneVerified(true)
            setShowPhoneBind(false)
            setPhoneInput("")
            setPhoneCode("")
            setPhoneCodeSent(false)
        } catch (e: any) {
            toast.error("验证失败", { description: e.message })
        } finally {
            setPhoneVerifying(false)
        }
    }

    // Email bind handlers
    const handleSendEmailCode = async () => {
        if (!emailInput || emailCountdown > 0) return
        setEmailSending(true)
        try {
            const { sendEmailBindCode } = await import("@/app/actions/account")
            const res = await sendEmailBindCode(emailInput)
            if (!res.success) {
                toast.error(res.message)
                return
            }
            setEmailCodeSent(true)
            setEmailCountdown(60)
            toast.success("验证码已发送到邮箱")
        } catch (e: any) {
            toast.error("发送失败", { description: e.message })
        } finally {
            setEmailSending(false)
        }
    }

    const handleVerifyEmail = async () => {
        if (!emailInput || !emailCode) return
        setEmailVerifying(true)
        try {
            const { verifyEmailBindCode } = await import("@/app/actions/account")
            const res = await verifyEmailBindCode(emailInput, emailCode)
            if (!res.success) {
                toast.error(res.message)
                return
            }
            toast.success("邮箱绑定成功")
            setEmail(emailInput)
            setEmailVerified(true)
            setIsVirtualEmail(false)
            setShowEmailBind(false)
            setEmailInput("")
            setEmailCode("")
            setEmailCodeSent(false)
        } catch (e: any) {
            toast.error("验证失败", { description: e.message })
        } finally {
            setEmailVerifying(false)
        }
    }

    const maskPhone = (p: string) => {
        if (!p || p.length < 7) return p
        return p.slice(0, 3) + "****" + p.slice(-4)
    }

    const maskEmail = (e: string) => {
        if (!e) return e
        const [name, domain] = e.split("@")
        if (!domain) return e
        const maskedName = name.length > 2 ? name[0] + "***" + name.slice(-1) : name
        return `${maskedName}@${domain}`
    }

    if (loading) {
        return (
            <div className="rounded-2xl border border-border bg-card/50 p-4">
                <div className="flex items-center gap-2 animate-pulse">
                    <div className="h-5 w-5 bg-muted rounded" />
                    <div className="h-4 w-24 bg-muted rounded" />
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {/* Email Row */}
            <div className="rounded-2xl border border-border bg-card/50 p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20">
                            <Mail className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                            <p className="font-semibold text-foreground text-sm">邮箱</p>
                            {email && !isVirtualEmail ? (
                                <div className="flex items-center gap-1.5">
                                    <p className="text-xs text-muted-foreground">{maskEmail(email)}</p>
                                    {emailVerified && (
                                        <span className="inline-flex items-center gap-0.5 text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full">
                                            <Check className="h-2.5 w-2.5" /> 已验证
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground/50">未绑定</p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setShowEmailBind(!showEmailBind)
                            setShowPhoneBind(false)
                        }}
                        className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-0.5"
                    >
                        {email && !isVirtualEmail ? "换绑" : "绑定"}
                        <ChevronRight className="h-3 w-3" />
                    </button>
                </div>

                {/* Email Bind Form */}
                {showEmailBind && (
                    <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                        <div className="relative">
                            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/40" />
                            <Input
                                type="email"
                                placeholder="输入新邮箱地址"
                                value={emailInput}
                                onChange={(e) => setEmailInput(e.target.value)}
                                className="pl-10 h-9 text-sm bg-muted/20 border-border"
                            />
                        </div>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/40" />
                                <Input
                                    type="text"
                                    placeholder="验证码"
                                    value={emailCode}
                                    onChange={(e) => setEmailCode(e.target.value)}
                                    className="pl-10 h-9 text-sm bg-muted/20 border-border"
                                    maxLength={6}
                                />
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-20 text-xs"
                                disabled={emailSending || emailCountdown > 0 || !emailInput}
                                onClick={handleSendEmailCode}
                            >
                                {emailSending ? <Loader2 className="h-3 w-3 animate-spin" /> : emailCountdown > 0 ? `${emailCountdown}s` : "发送"}
                            </Button>
                        </div>
                        {emailCodeSent && (
                            <Button
                                size="sm"
                                className="w-full h-8 text-xs bg-primary text-primary-foreground"
                                disabled={emailVerifying || !emailCode}
                                onClick={handleVerifyEmail}
                            >
                                {emailVerifying ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                确认绑定
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Phone Row */}
            <div className="rounded-2xl border border-border bg-card/50 p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/20">
                            <Phone className="h-5 w-5 text-green-400" />
                        </div>
                        <div>
                            <p className="font-semibold text-foreground text-sm">手机号</p>
                            {phone ? (
                                <div className="flex items-center gap-1.5">
                                    <p className="text-xs text-muted-foreground">{maskPhone(phone)}</p>
                                    {phoneVerified && (
                                        <span className="inline-flex items-center gap-0.5 text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full">
                                            <Check className="h-2.5 w-2.5" /> 已验证
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground/50">未绑定</p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setShowPhoneBind(!showPhoneBind)
                            setShowEmailBind(false)
                        }}
                        className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-0.5"
                    >
                        {phone ? "换绑" : "绑定"}
                        <ChevronRight className="h-3 w-3" />
                    </button>
                </div>

                {/* Phone Bind Form */}
                {showPhoneBind && (
                    <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                        <div className="relative">
                            <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/40" />
                            <Input
                                type="tel"
                                placeholder="输入手机号码"
                                value={phoneInput}
                                onChange={(e) => setPhoneInput(e.target.value)}
                                className="pl-10 h-9 text-sm bg-muted/20 border-border"
                                maxLength={11}
                            />
                        </div>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/40" />
                                <Input
                                    type="text"
                                    placeholder="验证码"
                                    value={phoneCode}
                                    onChange={(e) => setPhoneCode(e.target.value)}
                                    className="pl-10 h-9 text-sm bg-muted/20 border-border"
                                    maxLength={6}
                                />
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-20 text-xs"
                                disabled={phoneSending || phoneCountdown > 0 || !phoneInput}
                                onClick={handleSendPhoneCode}
                            >
                                {phoneSending ? <Loader2 className="h-3 w-3 animate-spin" /> : phoneCountdown > 0 ? `${phoneCountdown}s` : "发送"}
                            </Button>
                        </div>
                        {phoneCodeSent && (
                            <Button
                                size="sm"
                                className="w-full h-8 text-xs bg-primary text-primary-foreground"
                                disabled={phoneVerifying || !phoneCode}
                                onClick={handleVerifyPhone}
                            >
                                {phoneVerifying ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                确认绑定
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
