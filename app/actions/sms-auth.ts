'use server'

import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendSmsVerificationCode } from '@/lib/sms'

// Response interface (consistent with auth.ts)
export interface SmsAuthResponse {
    success: boolean
    message: string
    error?: string
}

// Phone number validation (Chinese mobile)
const PhoneSchema = z.string().regex(
    /^1[3-9]\d{9}$/,
    { message: '请输入有效的中国手机号码' }
)

// Rate limiting map (in-memory, production should use Redis)
const SMS_RATE_LIMIT = new Map<string, number>()

/**
 * Generate a 6-digit random code
 */
function generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Phone-based email for Supabase auth
 * Supabase requires email, so we create a virtual email from phone number
 */
function phoneToEmail(phone: string): string {
    return `${phone}@sms.citylord.local`
}

/**
 * Send SMS verification code for login or registration
 */
export async function sendSmsCode(
    phone: string,
    type: 'login' | 'register',
    password?: string
): Promise<SmsAuthResponse> {
    try {
        // 1. Validate phone number
        const cleaned = phone.replace(/\s+/g, '')
        const phoneResult = PhoneSchema.safeParse(cleaned)
        if (!phoneResult.success) {
            return { success: false, message: '手机号格式错误', error: phoneResult.error.errors[0].message }
        }

        // 2. Rate limiting (60 seconds per phone)
        const lastRequest = SMS_RATE_LIMIT.get(cleaned)
        const now = Date.now()
        if (lastRequest && (now - lastRequest) < 60000) {
            return { success: false, message: '发送过于频繁，请稍后再试' }
        }
        SMS_RATE_LIMIT.set(cleaned, now)

        // 3. Generate OTP code
        const code = generateCode()
        const virtualEmail = phoneToEmail(cleaned)

        // 4. Create/update user in Supabase via admin
        let error

        if (type === 'register') {
            if (!password || password.length < 6) {
                return { success: false, message: '密码长度需至少6位' }
            }

            // Check if phone already registered
            const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
            const phoneExists = existingUsers?.users?.some(
                u => u.phone === cleaned || u.email === virtualEmail
            )
            if (phoneExists) {
                return { success: false, message: '该手机号已注册，请直接登录' }
            }

            // Generate signup link (creates user with OTP)
            const res = await supabaseAdmin.auth.admin.generateLink({
                type: 'signup',
                email: virtualEmail,
                password,
                options: {
                    data: {
                        nickname: `用户${cleaned.slice(-4)}`,
                        phone: cleaned,
                    }
                }
            })
            error = res.error
        } else {
            // Login
            // Check if user exists
            const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
            const userExists = existingUsers?.users?.some(
                u => u.phone === cleaned || u.email === virtualEmail || u.app_metadata?.phone === cleaned
            )

            if (!userExists) {
                return { success: false, message: '该手机号未注册，请先注册' }
            }

            const res = await supabaseAdmin.auth.admin.generateLink({
                type: 'magiclink',
                email: virtualEmail,
            })
            error = res.error
        }

        if (error) {
            console.error('[SmsAuth] GenerateLink Error:', error)
            let msg = '验证码生成失败'
            if (error.message?.includes('already registered')) {
                msg = '该手机号已注册，请直接登录'
            } else if (error.status === 429) {
                msg = '请求过多，请稍后再试'
            }
            return { success: false, message: msg, error: error.message }
        }

        // 5. Send SMS via Tencent Cloud
        const smsResult = await sendSmsVerificationCode(cleaned, code)
        if (!smsResult.success) {
            console.error('[SmsAuth] SMS send failed:', smsResult.error)
            return {
                success: false,
                message: '短信发送失败，请稍后再试',
                error: smsResult.error
            }
        }

        // 6. Store the code temporarily in Supabase user metadata
        // We use admin to update user app_metadata with the OTP code + expiry
        const { data: users } = await supabaseAdmin.auth.admin.listUsers()
        const targetUser = users?.users?.find(
            u => u.phone === cleaned || u.email === virtualEmail || u.app_metadata?.phone === cleaned
        )

        if (targetUser) {
            await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
                app_metadata: {
                    ...targetUser.app_metadata,
                    sms_otp: code,
                    sms_otp_expires: Date.now() + 5 * 60 * 1000, // 5 minutes
                    sms_otp_phone: cleaned,
                }
            })
        }

        return { success: true, message: '验证码已发送' }

    } catch (err: any) {
        console.error('[SmsAuth] Unexpected Error:', err)
        return { success: false, message: '服务暂时不可用，请稍后再试', error: err.message }
    }
}

/**
 * Verify SMS code and sign in / register user
 */
export async function verifySmsCode(
    phone: string,
    code: string,
    type: 'login' | 'register',
    origin?: string
): Promise<SmsAuthResponse & { session?: any, actionLink?: string, tokenHash?: string }> {
    try {
        const cleaned = phone.replace(/\s+/g, '')
        const phoneResult = PhoneSchema.safeParse(cleaned)
        if (!phoneResult.success) {
            return { success: false, message: '手机号格式错误' }
        }

        if (!code || code.length !== 6) {
            return { success: false, message: '请输入6位验证码' }
        }

        const virtualEmail = phoneToEmail(cleaned)

        // Find user
        const { data: users } = await supabaseAdmin.auth.admin.listUsers()
        const targetUser = users?.users?.find(
            u => u.phone === cleaned || u.email === virtualEmail || u.app_metadata?.phone === cleaned
        )

        if (!targetUser) {
            return { success: false, message: type === 'login' ? '该手机号未注册' : '用户创建失败，请重试' }
        }

        // Verify OTP from app_metadata
        const storedOtp = targetUser.app_metadata?.sms_otp
        const otpExpires = targetUser.app_metadata?.sms_otp_expires
        const otpPhone = targetUser.app_metadata?.sms_otp_phone

        if (!storedOtp || !otpExpires) {
            return { success: false, message: '请先获取验证码' }
        }

        if (otpPhone !== cleaned) {
            return { success: false, message: '验证码与手机号不匹配' }
        }

        if (Date.now() > otpExpires) {
            return { success: false, message: '验证码已过期，请重新获取' }
        }

        if (storedOtp !== code) {
            return { success: false, message: '验证码错误' }
        }

        // Clear OTP from metadata and store phone in app_metadata (service_role only)
        await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
            phone_confirm: true,
            app_metadata: {
                ...targetUser.app_metadata,
                sms_otp: null,
                sms_otp_expires: null,
                sms_otp_phone: null,
                phone: cleaned,          // Authoritative phone storage, only service_role can write
            }
        })

        // For registration, confirm the user's email too
        if (type === 'register') {
            await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
                email_confirm: true,
            })
        }

        let actionLink = undefined;
        let tokenHash = undefined;
        if (type === 'login') {
            const linkRes = await supabaseAdmin.auth.admin.generateLink({
                type: 'magiclink',
                email: virtualEmail,
                options: {
                    redirectTo: origin ? `${origin}/auth/callback` : undefined
                }
            })
            if (linkRes.error || !linkRes.data?.properties?.action_link) {
                return { success: false, message: '登录凭证生成失败，请稍后再试', error: linkRes.error?.message }
            }
            actionLink = linkRes.data.properties.action_link
            // Extract hashed_token for direct client-side verifyOtp (avoids browser redirect)
            tokenHash = linkRes.data.properties.hashed_token
        }

        return {
            success: true,
            message: type === 'register' ? '注册成功' : '验证成功',
            actionLink,
            tokenHash,
        }
    } catch (err: any) {
        console.error('[SmsAuth] Verify Error:', err)
        return { success: false, message: '验证失败，请稍后再试', error: err.message }
    }
}
