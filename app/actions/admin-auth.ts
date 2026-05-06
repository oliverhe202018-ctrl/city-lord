'use server'

import { cookies } from 'next/headers'
import { signAdminToken } from '@/lib/admin/auth'

// ── Admin Login Server Action ────────────────────────────────────────────────
// Authenticates via hardcoded username and password as requested.
// Sets a secure HTTP-only cookie for session management.

export interface AdminLoginResult {
    success: boolean
    message: string
}

export async function adminLogin(
    username: string,
    password: string
): Promise<AdminLoginResult> {
    try {
        const validUsername = process.env.ADMIN_USERNAME;
        const validPassword = process.env.ADMIN_PASSWORD;

        if (!validUsername || !validPassword) {
            console.error('[adminLogin] ADMIN_USERNAME / ADMIN_PASSWORD not configured');
            return {
                success: false,
                message: '系统配置异常，请联系管理员',
            };
        }

        if (username === validUsername && password === validPassword) {
            const signedToken = await signAdminToken('admin_v1')

            const cookieStore = await cookies()
            cookieStore.set('citylord_admin_session', signedToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 60 * 60 * 24 * 7
            })

            return {
                success: true,
                message: '登录成功',
            }
        }

        return {
            success: false,
            message: '账号或密码错误',
        }
    } catch (err: unknown) {
        console.error('[adminLogin] Unexpected error:', err)
        return {
            success: false,
            message: '系统异常，请稍后重试',
        }
    }
}
