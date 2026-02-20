'use server'

import { cookies } from 'next/headers'

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
        if (username === 'a251513541' && password === 'aaa021300') {
            // Set a secure HTTP-only cookie
            const cookieStore = await cookies()
            cookieStore.set('citylord_admin_session', 'authenticated', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 60 * 60 * 24 * 7 // 1 week
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
