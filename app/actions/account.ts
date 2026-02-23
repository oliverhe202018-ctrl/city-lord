'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendSmsVerificationCode } from '@/lib/sms'
import { sendVerificationCode as sendEmailVerificationCode } from '@/lib/email'
import { z } from 'zod'

// Phone number validation (Chinese mobile)
const PhoneSchema = z.string().regex(
    /^1[3-9]\d{9}$/,
    { message: '请输入有效的中国手机号码' }
)

const EmailSchema = z.string().email({ message: '请输入有效的邮箱地址' })

// Rate limiting (in-memory)
const BIND_RATE_LIMIT = new Map<string, number>()

function generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Get current account info (email + phone)
 */
export async function getAccountInfo() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: '未登录' }
    }

    return {
        success: true,
        data: {
            email: user.email || null,
            phone: user.phone || user.user_metadata?.phone || null,
            emailVerified: !!user.email_confirmed_at,
            phoneVerified: !!user.phone_confirmed_at,
            // Check if this is a virtual (phone-based) email
            isVirtualEmail: user.email?.endsWith('@sms.citylord.local') || false,
        }
    }
}

/**
 * Send verification code to bind a phone number
 */
export async function sendPhoneBindCode(phone: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, message: '未登录' }

    // Validate phone
    const cleaned = phone.replace(/\s+/g, '')
    const phoneResult = PhoneSchema.safeParse(cleaned)
    if (!phoneResult.success) {
        return { success: false, message: phoneResult.error.errors[0].message }
    }

    // Rate limiting
    const key = `phone:${user.id}`
    const last = BIND_RATE_LIMIT.get(key)
    if (last && Date.now() - last < 60000) {
        return { success: false, message: '发送过于频繁，请60秒后再试' }
    }
    BIND_RATE_LIMIT.set(key, Date.now())

    // Check if phone already bound to another user
    const { data: users } = await supabaseAdmin.auth.admin.listUsers()
    const phoneUsed = users?.users?.some(
        u => u.id !== user.id && (u.phone === cleaned || u.user_metadata?.phone === cleaned)
    )
    if (phoneUsed) {
        return { success: false, message: '该手机号已被其他账号绑定' }
    }

    // Generate and store OTP
    const code = generateCode()
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
        app_metadata: {
            ...user.app_metadata,
            bind_phone_otp: code,
            bind_phone_otp_expires: Date.now() + 5 * 60 * 1000,
            bind_phone_target: cleaned,
        }
    })

    // Send SMS
    const smsResult = await sendSmsVerificationCode(cleaned, code)
    if (!smsResult.success) {
        return { success: false, message: '短信发送失败', error: smsResult.error }
    }

    return { success: true, message: '验证码已发送' }
}

/**
 * Verify code and bind phone number
 */
export async function verifyPhoneBindCode(phone: string, code: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, message: '未登录' }

    const cleaned = phone.replace(/\s+/g, '')

    // Refresh user to get latest metadata
    const { data: freshUser } = await supabaseAdmin.auth.admin.getUserById(user.id)
    if (!freshUser?.user) return { success: false, message: '用户信息获取失败' }

    const meta = freshUser.user.app_metadata
    if (!meta?.bind_phone_otp || !meta?.bind_phone_otp_expires) {
        return { success: false, message: '请先获取验证码' }
    }

    if (meta.bind_phone_target !== cleaned) {
        return { success: false, message: '手机号与验证码不匹配' }
    }

    if (Date.now() > meta.bind_phone_otp_expires) {
        return { success: false, message: '验证码已过期' }
    }

    if (meta.bind_phone_otp !== code) {
        return { success: false, message: '验证码错误' }
    }

    // Bind phone
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
        phone: cleaned,
        phone_confirm: true,
        user_metadata: {
            ...freshUser.user.user_metadata,
            phone: cleaned,
        },
        app_metadata: {
            ...meta,
            bind_phone_otp: null,
            bind_phone_otp_expires: null,
            bind_phone_target: null,
        }
    })

    return { success: true, message: '手机号绑定成功' }
}

/**
 * Send verification code to change/bind email
 */
export async function sendEmailBindCode(email: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, message: '未登录' }

    // Validate email
    const result = EmailSchema.safeParse(email)
    if (!result.success) {
        return { success: false, message: result.error.errors[0].message }
    }

    // Rate limiting
    const key = `email:${user.id}`
    const last = BIND_RATE_LIMIT.get(key)
    if (last && Date.now() - last < 60000) {
        return { success: false, message: '发送过于频繁，请60秒后再试' }
    }
    BIND_RATE_LIMIT.set(key, Date.now())

    // Generate and store OTP
    const code = generateCode()
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
        app_metadata: {
            ...user.app_metadata,
            bind_email_otp: code,
            bind_email_otp_expires: Date.now() + 5 * 60 * 1000,
            bind_email_target: email,
        }
    })

    // Send email
    const emailResult = await sendEmailVerificationCode(email, code, 'register')
    if (!emailResult.success) {
        return { success: false, message: '邮件发送失败', error: emailResult.error }
    }

    return { success: true, message: '验证码已发送到邮箱' }
}

/**
 * Verify code and bind/change email
 */
export async function verifyEmailBindCode(email: string, code: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, message: '未登录' }

    // Refresh user
    const { data: freshUser } = await supabaseAdmin.auth.admin.getUserById(user.id)
    if (!freshUser?.user) return { success: false, message: '用户信息获取失败' }

    const meta = freshUser.user.app_metadata
    if (!meta?.bind_email_otp || !meta?.bind_email_otp_expires) {
        return { success: false, message: '请先获取验证码' }
    }

    if (meta.bind_email_target !== email) {
        return { success: false, message: '邮箱与验证码不匹配' }
    }

    if (Date.now() > meta.bind_email_otp_expires) {
        return { success: false, message: '验证码已过期' }
    }

    if (meta.bind_email_otp !== code) {
        return { success: false, message: '验证码错误' }
    }

    // Update email
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
        email,
        email_confirm: true,
        app_metadata: {
            ...meta,
            bind_email_otp: null,
            bind_email_otp_expires: null,
            bind_email_target: null,
        }
    })

    return { success: true, message: '邮箱绑定成功' }
}
