'use server'

import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendVerificationCode } from '@/lib/email'

// Response interface for client consistency
export interface ActionResponse {
    success: boolean
    message: string
    error?: string
}

// Zod schema for email validation
const EmailSchema = z.string().email({ message: "无效的邮箱格式" })

// Rate limiting map (simple in-memory for demo, ideal is Redis/KV)
const RATE_LIMIT_MAP = new Map<string, number>()

export async function sendAuthCode(
    email: string,
    type: 'login' | 'register',
    password?: string
): Promise<ActionResponse> {
    try {
        // 1. Validate Email
        const emailResult = EmailSchema.safeParse(email)
        if (!emailResult.success) {
            return { success: false, message: "邮箱格式错误", error: emailResult.error.errors[0].message }
        }

        // 2. Simple Rate Limiting (1 request per 60 seconds per email)
        const lastRequest = RATE_LIMIT_MAP.get(email)
        const now = Date.now()
        if (lastRequest && (now - lastRequest) < 60000) {
            return { success: false, message: "发送过于频繁，请稍后再试" }
        }
        RATE_LIMIT_MAP.set(email, now)

        // 3. Generate OTP via Supabase Admin
        // Using admin client ensures we bypass client-side network issues and have fuller control
        let data, error

        if (type === 'register') {
            if (!password || password.length < 6) {
                return { success: false, message: "密码长度需至少6位" }
            }

            // Generate Signup Link (returns OTP)
            const res = await supabaseAdmin.auth.admin.generateLink({
                type: 'signup',
                email,
                password,
                options: {
                    data: {
                        nickname: email.split('@')[0], // Default nickname
                    }
                }
            })
            data = res.data
            error = res.error
        } else {
            // Login (Magic Link / OTP)
            const res = await supabaseAdmin.auth.admin.generateLink({
                type: 'magiclink',
                email,
            })
            data = res.data
            error = res.error
        }

        // 4. Handle Supabase Admin Errors
        if (error) {
            console.error('[AuthAction] GenerateLink Error:', error)

            // Map common errors to user-friendly messages
            let msg = "验证码生成失败"
            if (error.message?.includes("already registered") || error.code === 'email_exists') {
                msg = "该邮箱已注册，请直接登录"
            } else if (error.message?.includes("not found")) {
                msg = "账号不存在，请先注册"
            } else if (error.status === 429) {
                msg = "请求过多，请稍后再试"
            }

            return { success: false, message: msg, error: error.message }
        }

        // 5. Extract OTP
        // properties.email_otp contains the 6-digit code usually
        const otp = data?.properties?.email_otp
        const actionLink = data?.properties?.action_link

        if (!otp && !actionLink) {
            console.error('[AuthAction] No OTP returned:', data)
            return { success: false, message: "系统错误：未获取到验证码" }
        }

        // Fallback: if OTP is missing but link exists (unlikely for these types), valid logic might differ
        // For 'signup' and 'magiclink', email_otp should be present.
        const codeToSend = otp || "ERROR"

        if (codeToSend === "ERROR") {
            return { success: false, message: "验证码获取异常" }
        }

        // 6. Send Email via Resend
        // This allows us to use our custom email template and provider independently of Supabase's internal mailer
        const sendRes = await sendVerificationCode(email, codeToSend, type)

        if (!sendRes.success) {
            console.error('[AuthAction] Resend Error:', sendRes.error)
            return { success: false, message: "邮件发送失败，请检查邮箱是否正确或稍后再试", error: String(sendRes.error) }
        }

        return { success: true, message: "验证码已发送" }

    } catch (err: any) {
        console.error('[AuthAction] Unexpected Error:', err)
        return { success: false, message: "服务暂时不可用，请稍后再试", error: err.message }
    }
}
