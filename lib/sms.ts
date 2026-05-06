'use server'

/**
 * Spug Push Service (Replaces Tencent Cloud SMS)
 * Uses simple HTTP POST to send push notifications (SMS/WeChat/DingTalk/etc)
 * 
 * Required env vars:
 *   SPUG_PUSH_TOKEN - Your unique token from push.spug.cc
 */

interface SmsResult {
    success: boolean
    data?: any
    error?: string
}

/**
 * Send an SMS verification code via Spug Push Assistant
 * @param phone - Phone number
 * @param code - The verification code to send
 */
export async function sendSmsVerificationCode(
    phone: string,
    code: string
): Promise<SmsResult> {
    const pushToken = process.env.SPUG_PUSH_TOKEN

    if (!pushToken) {
        console.error('[SMS/Push] Missing SPUG_PUSH_TOKEN configuration')
        return {
            success: false,
            error: '推送服务未配置，请联系管理员'
        }
    }

    // Normalize phone number (Spug templates will replace ${phone} and ${code})
    const normalizedPhone = phone.replace(/\s+/g, '')

    try {
        // According to user's Spug SMS template:
        // url: https://push.spug.cc/sms/{TOKEN}
        // payload: to, name, code, number
        const payload = {
            to: normalizedPhone,
            name: '城主大人', // 称呼
            code: code, // 验证码
            number: '5', // 几分钟内有效
        }

        const res = await fetch(`https://push.spug.cc/sms/${pushToken}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        })

        if (!res.ok) {
            const errText = await res.text()
            console.error('[SMS/Push] Spug Push failed (HTTP Status):', res.status, errText)
            return {
                success: false,
                error: '消息推送网络请求失败'
            }
        }

        const resultJson = await res.json()

        // Spug API usually returns a code 200 for success
        if (resultJson.code === 200) {
            return {
                success: true,
                data: {
                    serialNo: resultJson.data?.id || 'spug-push',
                    phone: normalizedPhone,
                }
            }
        } else {
            console.error('[SMS/Push] Spug Push returned error:', resultJson)
            return {
                success: false,
                error: resultJson.msg || '消息推送平台报错'
            }
        }
    } catch (err: any) {
        console.error('[SMS/Push] Spug Push exception:', err)
        return {
            success: false,
            error: err.message || '系统服务调用异常'
        }
    }
}
