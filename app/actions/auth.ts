'use server'

import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendVerificationCode } from '@/lib/email'
import type { EmailType } from '@/lib/email'
import { rateLimit } from '@/lib/cache'

// Response interface for client consistency
export interface ActionResponse {
    success: boolean
    message: string
    error?: string
    retryAfterSeconds?: number
    cooldownEndsAt?: number
}

// Zod schema for email validation
const EmailSchema = z.string().email({ message: "无效的邮箱格式" })

export async function sendAuthCode(
    email: string,
    type: 'login' | 'register',
    password?: string
): Promise<ActionResponse> {
    try {
        // 0. Normalize Email
        const normalizedEmail = email.trim().toLowerCase()
        
        // 1. Validate Email
        const emailResult = EmailSchema.safeParse(normalizedEmail)
        if (!emailResult.success) {
            return { success: false, message: "邮箱格式错误", error: emailResult.error.errors[0].message }
        }
        
        console.log(`[AuthAction] Sending code for: ${normalizedEmail}, type: ${type}`)

        // 2. Server-side Rate Limiting via Redis (1 request per 60 seconds per email/type)
        const limitKey = `rl:auth:${type}:${normalizedEmail}`
        const rl = await rateLimit(limitKey, 60, 1)
        
        console.log(`[AuthAction] RateLimit Check: key=${limitKey}, allowed=${rl.allowed}, retryAfter=${rl.retryAfterSec}`)
        
        if (!rl.allowed) {
            const cooldownEndsAt = Date.now() + (rl.retryAfterSec * 1000)
            return { 
                success: false, 
                message: `发送过于频繁，请 ${rl.retryAfterSec} 秒后再试`,
                retryAfterSeconds: rl.retryAfterSec,
                cooldownEndsAt
            }
        }

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
                return { success: false, message: msg, error: error.message, retryAfterSeconds: 60, cooldownEndsAt: Date.now() + 60000 }
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

        // 6. Send Email via ZeptoMail
        // This allows us to use our custom email template and provider independently of Supabase's internal mailer
        const emailType: EmailType = type === 'register' ? 'register' : 'login'
        const sendRes = await sendVerificationCode(email, codeToSend, emailType)

        if (!sendRes.success) {
            console.error('[AuthAction] ZeptoMail Error:', sendRes.error)
            return { success: false, message: "邮件发送失败，请检查邮箱是否正确或稍后再试", error: String(sendRes.error) }
        }

        return { success: true, message: "验证码已发送", retryAfterSeconds: 60, cooldownEndsAt: Date.now() + 60000 }

    } catch (err: any) {
        console.error('[AuthAction] Unexpected Error:', err)
        return { success: false, message: "服务暂时不可用，请稍后再试", error: err.message }
    }
}

/**
 * Send a password reset verification code.
 * Uses Supabase Admin generateLink(type:'recovery') to get an OTP,
 * then sends it via ZeptoMail with the 'reset' template.
 */
export async function sendResetPasswordCode(email: string): Promise<ActionResponse> {
    try {
        const emailResult = EmailSchema.safeParse(email)
        if (!emailResult.success) {
            return { success: false, message: "邮箱格式错误", error: emailResult.error.errors[0].message }
        }

        // Rate limiting via Redis
        const rl = await rateLimit(`rl:reset:${email}`, 60, 1)
        if (!rl.allowed) {
            return { 
                success: false, 
                message: `发送过于频繁，请 ${rl.retryAfterSec} 秒后再试`,
                retryAfterSeconds: rl.retryAfterSec,
                cooldownEndsAt: Date.now() + (rl.retryAfterSec * 1000)
            }
        }

        // Generate recovery link (returns OTP)
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: 'recovery',
            email,
        })

        if (error) {
            console.error('[AuthAction] Recovery GenerateLink Error:', error)
            let msg = "验证码生成失败"
            if (error.message?.includes("not found") || error.message?.includes("User not found")) {
                msg = "该邮箱未注册"
            } else if (error.status === 429) {
                msg = "请求过多，请稍后再试"
                return { success: false, message: msg, error: error.message, retryAfterSeconds: 60, cooldownEndsAt: Date.now() + 60000 }
            }
            return { success: false, message: msg, error: error.message }
        }

        const otp = data?.properties?.email_otp
        if (!otp) {
            console.error('[AuthAction] No reset OTP returned:', data)
            return { success: false, message: "系统错误：未获取到验证码" }
        }

        // Send reset email
        const sendRes = await sendVerificationCode(email, otp, 'reset')
        if (!sendRes.success) {
            console.error('[AuthAction] ZeptoMail Reset Error:', sendRes.error)
            return { success: false, message: "邮件发送失败，请检查邮箱是否正确或稍后再试", error: String(sendRes.error) }
        }

        return { success: true, message: "重置验证码已发送", retryAfterSeconds: 60, cooldownEndsAt: Date.now() + 60000 }
    } catch (err: any) {
        console.error('[AuthAction] Reset Unexpected Error:', err)
        return { success: false, message: "服务暂时不可用，请稍后再试", error: err.message }
    }
}

