/**
 * Supabase Edge Function: send-push-notification
 *
 * 由 Database Webhook 触发，根据事件类型向目标用户发送 FCM 推送通知。
 * 支持三类事件：
 *   - territory_attacks INSERT → 通知 defender_id
 *   - messages INSERT → 通知 user_id
 *   - mission_completions INSERT → 通知 user_id
 *
 * 认证方式：FCM HTTP v1 API + Service Account (OAuth2 Bearer Token)
 * Webhook 来源验证：SUPABASE_WEBHOOK_SECRET JWT
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ============================================================
// Service Account JSON → OAuth2 Bearer Token
// ============================================================

interface ServiceAccount {
    project_id: string
    private_key: string
    client_email: string
    token_uri: string
}

/**
 * 使用 Service Account 私钥签发 JWT，换取 Google OAuth2 access token
 */
async function getAccessToken(sa: ServiceAccount): Promise<string> {
    const now = Math.floor(Date.now() / 1000)
    const header = { alg: "RS256", typ: "JWT" }
    const payload = {
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: sa.token_uri,
        iat: now,
        exp: now + 3600,
    }

    const encoder = new TextEncoder()

    // Base64url encode
    function base64url(data: Uint8Array): string {
        const binStr = Array.from(data).map((b) => String.fromCharCode(b)).join("")
        return btoa(binStr).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
    }

    const headerB64 = base64url(encoder.encode(JSON.stringify(header)))
    const payloadB64 = base64url(encoder.encode(JSON.stringify(payload)))
    const signingInput = `${headerB64}.${payloadB64}`

    // Import RSA private key
    const pemContent = sa.private_key
        .replace(/-----BEGIN PRIVATE KEY-----/g, "")
        .replace(/-----END PRIVATE KEY-----/g, "")
        .replace(/\s/g, "")

    const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0))

    const cryptoKey = await crypto.subtle.importKey(
        "pkcs8",
        binaryKey,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"]
    )

    const signature = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        cryptoKey,
        encoder.encode(signingInput)
    )

    const jwt = `${signingInput}.${base64url(new Uint8Array(signature))}`

    // Exchange JWT for access token
    const tokenRes = await fetch(sa.token_uri, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    })

    if (!tokenRes.ok) {
        const errText = await tokenRes.text()
        throw new Error(`OAuth2 token exchange failed: ${tokenRes.status} ${errText}`)
    }

    const tokenData = await tokenRes.json()
    return tokenData.access_token
}

// ============================================================
// 通知构建
// ============================================================

interface NotificationPayload {
    title: string
    body: string
    route: string
    targetUserId: string
}

/**
 * 根据 Webhook payload 中的表名和记录构建通知内容
 */
function buildNotification(table: string, record: Record<string, any>): NotificationPayload | null {
    switch (table) {
        case "territory_attacks":
            return {
                title: "⚔️ 你的领地正在被攻击！",
                body: `你的领地 [${record.territory_name || "未知领地"}] 正受到攻击，快去防守！`,
                route: "/game?tab=territory",
                targetUserId: record.defender_id,
            }

        case "messages":
            return {
                title: "💬 你收到一条新消息",
                body: (record.content || "").slice(0, 100) || "有人给你发了消息",
                route: "/game?tab=social",
                targetUserId: record.user_id,
            }

        case "mission_completions":
            return {
                title: "🎯 任务完成！",
                body: `恭喜！你完成了任务 [${record.mission_title || "任务"}]，快去领取奖励！`,
                route: "/game?tab=missions",
                targetUserId: record.user_id,
            }

        default:
            console.warn(`[send-push-notification] Unknown table: ${table}`)
            return null
    }
}

// ============================================================
// Main Handler
// ============================================================

serve(async (req) => {
    try {
        // 1. Webhook JWT 验证
        const webhookSecret = Deno.env.get("WEBHOOK_SECRET")
        if (webhookSecret) {
            const authHeader = req.headers.get("Authorization")
            if (!authHeader || authHeader !== `Bearer ${webhookSecret}`) {
                console.error("[send-push-notification] Unauthorized webhook call")
                return new Response(JSON.stringify({ error: "Unauthorized" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" },
                })
            }
        }

        // 2. 解析 Webhook payload
        const body = await req.json()
        const { type, table, record } = body

        if (type !== "INSERT" || !record) {
            return new Response(JSON.stringify({ message: "Ignored: not an INSERT event" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        }

        // 3. 构建通知
        const notification = buildNotification(table, record)
        if (!notification) {
            return new Response(JSON.stringify({ message: "Ignored: no notification for this table" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        }

        // 4. 查询目标用户的所有 device tokens
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        const { data: tokens, error: tokenErr } = await supabase
            .from("device_tokens")
            .select("id, token")
            .eq("user_id", notification.targetUserId)

        if (tokenErr) {
            console.error("[send-push-notification] Failed to query tokens:", tokenErr)
            return new Response(JSON.stringify({ error: "Token query failed" }), {
                status: 200, // 不影响触发它的数据库操作
                headers: { "Content-Type": "application/json" },
            })
        }

        if (!tokens || tokens.length === 0) {
            console.log("[send-push-notification] No device tokens found for user:", notification.targetUserId)
            return new Response(JSON.stringify({ message: "No tokens" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        }

        // 5. 获取 FCM access token（Service Account OAuth2）
        const serviceAccountJson = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON")
        if (!serviceAccountJson) {
            console.error("[send-push-notification] FCM_SERVICE_ACCOUNT_JSON not set")
            return new Response(JSON.stringify({ error: "FCM not configured" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        }

        const serviceAccount: ServiceAccount = JSON.parse(serviceAccountJson)
        const accessToken = await getAccessToken(serviceAccount)
        const fcmUrl = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`

        // 6. 批量发送推送通知
        const staleTokenIds: string[] = []

        await Promise.allSettled(
            tokens.map(async ({ id, token }: { id: string; token: string }) => {
                try {
                    const fcmRes = await fetch(fcmUrl, {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            message: {
                                token,
                                notification: {
                                    title: notification.title,
                                    body: notification.body,
                                },
                                data: {
                                    route: notification.route,
                                },
                                android: {
                                    priority: "high",
                                },
                            },
                        }),
                    })

                    if (!fcmRes.ok) {
                        const errBody = await fcmRes.json().catch(() => ({}))
                        const errorCode = errBody?.error?.details?.[0]?.errorCode ||
                            errBody?.error?.status || ""

                        // FCM 返回 UNREGISTERED → token 已失效，从表中删除
                        if (errorCode === "UNREGISTERED" || fcmRes.status === 404) {
                            console.log(`[send-push-notification] Stale token detected, marking for deletion: ${id}`)
                            staleTokenIds.push(id)
                        } else {
                            console.error(`[send-push-notification] FCM send failed for token ${id}:`, errBody)
                        }
                    } else {
                        console.log(`[send-push-notification] Sent to token ${id} successfully`)
                    }
                } catch (sendErr) {
                    console.error(`[send-push-notification] FCM request error for token ${id}:`, sendErr)
                }
            })
        )

        // 7. 清理失效 token
        if (staleTokenIds.length > 0) {
            const { error: deleteErr } = await supabase
                .from("device_tokens")
                .delete()
                .in("id", staleTokenIds)

            if (deleteErr) {
                console.error("[send-push-notification] Failed to delete stale tokens:", deleteErr)
            } else {
                console.log(`[send-push-notification] Deleted ${staleTokenIds.length} stale token(s)`)
            }
        }

        return new Response(
            JSON.stringify({
                message: "Processed",
                sent: tokens.length - staleTokenIds.length,
                staleRemoved: staleTokenIds.length,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        )
    } catch (error) {
        // 全局兜底：Edge Function 异常不影响触发它的数据库操作
        console.error("[send-push-notification] Unhandled error:", error)
        return new Response(
            JSON.stringify({ error: "Internal error", detail: error.message }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        )
    }
})
