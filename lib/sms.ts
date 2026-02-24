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
        // We use JSON payload so Spug can map ${code} in the message template
        // Spug uses 'targets' to determine where to send the message
        const payload = {
            name: '城主大人', // 对应模板中的 ${name}
            targets: normalizedPhone, // 这是 Spug 指定发送目标手机号的关键字段
            code: code,
        }

        const res = await fetch(`https://push.spug.cc/send/${pushToken}`, {
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
