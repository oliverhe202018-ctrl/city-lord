'use server'

/**
 * Tencent Cloud SMS Service
 * Uses the official tencentcloud-sdk-nodejs-sms SDK (API 3.0)
 * 
 * Required env vars:
 *   TENCENT_SMS_SECRET_ID
 *   TENCENT_SMS_SECRET_KEY
 *   TENCENT_SMS_SDK_APP_ID
 *   TENCENT_SMS_SIGN_NAME
 *   TENCENT_SMS_TEMPLATE_ID
 */

import * as tencentcloud from 'tencentcloud-sdk-nodejs-sms'

const SmsClient = tencentcloud.sms.v20210111.Client

interface SmsResult {
    success: boolean
    data?: any
    error?: string
}

/**
 * Send an SMS verification code via Tencent Cloud SMS
 * @param phone - Chinese phone number (with or without +86 prefix)
 * @param code - The verification code to send
 */
export async function sendSmsVerificationCode(
    phone: string,
    code: string
): Promise<SmsResult> {
    const secretId = process.env.TENCENT_SMS_SECRET_ID
    const secretKey = process.env.TENCENT_SMS_SECRET_KEY
    const sdkAppId = process.env.TENCENT_SMS_SDK_APP_ID
    const signName = process.env.TENCENT_SMS_SIGN_NAME
    const templateId = process.env.TENCENT_SMS_TEMPLATE_ID

    if (!secretId || !secretKey || !sdkAppId || !signName || !templateId) {
        console.error('[SMS] Missing Tencent Cloud SMS configuration')
        return {
            success: false,
            error: '短信服务未配置，请联系管理员'
        }
    }

    // Normalize phone number to +86 format
    let normalizedPhone = phone.replace(/\s+/g, '')
    if (!normalizedPhone.startsWith('+86')) {
        normalizedPhone = `+86${normalizedPhone}`
    }

    try {
        const client = new SmsClient({
            credential: {
                secretId,
                secretKey,
            },
            region: 'ap-guangzhou', // SMS region (ap-guangzhou is recommended)
            profile: {
                httpProfile: {
                    endpoint: 'sms.tencentcloudapi.com',
                },
            },
        })

        const params = {
            PhoneNumberSet: [normalizedPhone],
            SmsSdkAppId: sdkAppId,
            SignName: signName,
            TemplateId: templateId,
            TemplateParamSet: [code, '5'], // code + validity minutes
        }

        const result = await client.SendSms(params)

        // Check result
        const sendStatus = result.SendStatusSet?.[0]
        if (!sendStatus) {
            return { success: false, error: '短信发送结果异常' }
        }

        if (sendStatus.Code !== 'Ok') {
            console.error('[SMS] Send failed:', sendStatus.Code, sendStatus.Message)
            return {
                success: false,
                error: sendStatus.Message || '短信发送失败'
            }
        }

        return {
            success: true,
            data: {
                serialNo: sendStatus.SerialNo,
                phone: sendStatus.PhoneNumber,
            }
        }
    } catch (err: any) {
        console.error('[SMS] Tencent Cloud SMS error:', err)
        return {
            success: false,
            error: err.message || '短信服务调用异常'
        }
    }
}
