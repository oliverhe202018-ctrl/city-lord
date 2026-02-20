"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { adminLogin } from "@/app/actions/admin-auth"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Shield,
    Mail,
    Lock,
    Loader2,
    Eye,
    EyeOff,
    AlertCircle,
} from "lucide-react"
import { toast } from "sonner"

export default function AdminLoginPage() {
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const router = useRouter()

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault()
        if (!username || !password) {
            setErrorMsg("请输入账号和密码")
            return
        }

        setLoading(true)
        setErrorMsg(null)

        try {
            const result = await adminLogin(username, password)

            if (!result.success) {
                setErrorMsg(result.message)
                toast.error(result.message)
                return
            }

            toast.success("登录成功，正在进入后台...")
            // Force a full refresh to allow middleware to redirect to /admin
            window.location.href = "/admin"
        } catch (err) {
            console.error("[AdminLogin] Error:", err)
            setErrorMsg("系统异常，请稍后重试")
            toast.error("连接失败")
        } finally {
            setLoading(false)
        }
    }, [username, password, router])

    return (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#060a14]">
            {/* ── Animated background grid ── */}
            <div
                className="absolute inset-0 z-0 opacity-20"
                style={{
                    backgroundImage: `
            linear-gradient(rgba(99,179,237,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,179,237,0.06) 1px, transparent 1px)
          `,
                    backgroundSize: "48px 48px",
                }}
            />

            {/* ── Glow orbs ── */}
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] z-0 animate-pulse" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[120px] z-0 animate-pulse" style={{ animationDelay: "1.5s" }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-cyan-500/5 rounded-full blur-[80px] z-0" />

            {/* ── Card ── */}
            <div className="relative z-10 w-full max-w-sm px-4 animate-in fade-in slide-in-from-bottom-4 duration-700">

                {/* Header */}
                <div className="flex flex-col items-center mb-8">
                    {/* Shield icon with glow ring */}
                    <div className="relative mb-5">
                        <div className="absolute inset-0 rounded-full bg-blue-500/30 blur-xl scale-150" />
                        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-blue-500/30 border border-white/10">
                            <Shield className="w-8 h-8 text-white" strokeWidth={1.5} />
                        </div>
                    </div>

                    <h1 className="text-2xl font-bold text-white tracking-tight">
                        后台管理中心
                    </h1>
                    <p className="mt-1.5 text-sm text-white/40 text-center">
                        城市领主 · 管理员专属入口
                    </p>
                </div>

                {/* Form card */}
                <div className="rounded-2xl border border-white/8 bg-white/4 backdrop-blur-2xl shadow-2xl shadow-black/50 p-6 space-y-5">

                    {/* Error banner */}
                    {errorMsg && (
                        <div className="flex items-start gap-2.5 rounded-lg bg-red-500/10 border border-red-500/20 px-3.5 py-3 text-sm text-red-400 animate-in fade-in duration-300">
                            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Username */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                                管理员账号
                            </label>
                            <div className="relative group">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 group-focus-within:text-blue-400 transition-colors" />
                                <Input
                                    id="admin-username"
                                    type="text"
                                    autoComplete="username"
                                    placeholder="输入账号"
                                    value={username}
                                    onChange={(e) => {
                                        setUsername(e.target.value)
                                        setErrorMsg(null)
                                    }}
                                    className="pl-9 bg-white/5 border-white/8 text-white placeholder:text-white/20 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/50 h-11 rounded-lg transition-all"
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                                管理员密码
                            </label>
                            <div className="relative group">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 group-focus-within:text-blue-400 transition-colors" />
                                <Input
                                    id="admin-password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value)
                                        setErrorMsg(null)
                                    }}
                                    className="pl-9 pr-10 bg-white/5 border-white/8 text-white placeholder:text-white/20 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/50 h-11 rounded-lg transition-all"
                                    required
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((s) => !s)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                                    tabIndex={-1}
                                    aria-label={showPassword ? "隐藏密码" : "显示密码"}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Submit */}
                        <Button
                            type="submit"
                            disabled={loading || !username || !password}
                            className="w-full h-11 mt-1 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-semibold rounded-lg shadow-lg shadow-blue-500/20 border-0 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    验证身份中...
                                </>
                            ) : (
                                <>
                                    <Shield className="mr-2 h-4 w-4" />
                                    进入后台
                                </>
                            )}
                        </Button>
                    </form>

                    {/* Security notice */}
                    <p className="text-center text-[11px] text-white/20 pt-1">
                        此页面仅限授权管理员访问 · 操作日志将被记录
                    </p>
                </div>

                {/* Bottom hint */}
                <p className="mt-6 text-center text-xs text-white/20">
                    普通用户请前往{" "}
                    <a
                        href="/login"
                        className="text-white/40 hover:text-white/60 underline underline-offset-2 transition-colors"
                    >
                        用户登录
                    </a>
                </p>
            </div>
        </div>
    )
}
