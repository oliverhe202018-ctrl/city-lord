# 登录状态保持问题调试指南

## 问题描述
验证码登录后显示"登录成功"，但跳转到首页后仍然显示"登录/注册"弹窗，且登录状态未保持。

## 已添加的调试日志

以下位置已添加详细的 console 日志，请按顺序检查：

### 1. 登录页面日志
在输入验证码并点击登录后，浏览器控制台应显示：

```
[Login Page] Starting code login...
[Login Page] Email: user@example.com
[Login Page] Code: 123456
[Login Page] Token: present
[Login Page] Server response: { success: true, redirectUrl: "..." }
[Login Page] Redirecting to: https://...
```

**检查点：**
- Token 是否为 `present`？如果是 `missing`，说明 `send-code` API 没有正确返回 token
- Server response 是否包含 `redirectUrl`？

### 2. Login-with-code API 日志
后端控制台应显示：

```
[Login with Code] Processing request for: user@example.com
[Login with Code] Signature verified successfully
[Login with Code] Looking up user by email...
[Login with Code] User found: user_id_here
[Login with Code] Magic link generated successfully
```

**检查点：**
- 是否有错误信息？
- User 是否被找到？

### 3. Auth Callback 日志（关键！）
当浏览器被重定向到 `/auth/callback` 时，后端控制台应显示：

```
[Auth Callback] Processing request...
[Auth Callback] Code present: true
[Auth Callback] Next path: /
[Auth Callback] Exchange result: Success
[Auth Callback] Session established for user: user_id_here
[Auth Callback] User game data initialized
[Auth Callback] Cookies copied to response, count: X
[Auth Callback] Redirecting to: https://.../
```

**检查点：**
- Session 是否成功建立？
- **Cookies copied 的数量是多少？（应该大于 0）**
- 如果 Cookies count 是 0，说明 Cookie 传递失败

### 4. 首页日志
当首页加载时，浏览器控制台应显示：

```
[Page] Checking session...
[Page] Session check result: has session
[Page] Session user: user_id_here
```

如果 `Session check result: no session`，说明 session 没有正确持久化。

### 5. AuthSync 组件日志
当 `AuthSync` 组件加载时，浏览器控制台应显示：

```
[AuthSync] Checking initial session...
[AuthSync] Session found, user: user_id_here
[AuthSync] User profile synced: { ... }
```

## 最新修复说明

### 修复内容
在 `app/auth/callback/route.ts` 中添加了**手动 Cookie 传递逻辑**：

```typescript
// CRITICAL: Manual cookie preservation
// 手动从 cookieStore 提取所有 cookies 并设置到 redirect response
const allCookies = cookieStore.getAll()

const response = NextResponse.redirect(redirectUrl)

allCookies.forEach(({ name, value }) => {
  response.cookies.set(name, value, {
    httpOnly: true,
    secure: origin.startsWith('https'),
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 // 24 hours
  })
})
```

这样可以确保 Supabase 设置的 cookies 被正确传递到 redirect 响应中。

## 常见问题排查

### 问题 1：Cookie 设置失败

**症状：**
- Auth callback 显示 "Cookies copied to response, count: 0"
- 或浏览器开发者工具中没有 Supabase 相关的 Cookie

**解决方案：**
1. 检查浏览器开发者工具 → Application → Cookies
2. 查看是否有 `sb-access-token`、`sb-refresh-token` 等相关 Cookie
3. 如果 Cookie count 是 0，说明 cookieStore.getAll() 没有返回 cookies

### 问题 2：Token 过期或无效

**症状：**
- Login with code 返回 "Invalid verification code" 或 "Verification code expired"

**解决方案：**
1. 验证码 5 分钟内有效
2. 每次发送新验证码都会使旧验证码失效
3. 重新获取验证码并输入最新的

### 问题 3：Middleware 没有正确传递 Cookie

**症状：**
- Auth callback 成功
- 但后续请求没有携带 session

**解决方案：**
1. 检查 `lib/supabase/middleware.ts` 中的 cookie 传递逻辑
2. 确保 `cookiesToSet` 被正确应用到 response

## 下一步操作

1. 清除所有 Cookie 和 LocalStorage
2. 刷新页面
3. 尝试验证码登录
4. 打开浏览器控制台（F12），查看上述日志
5. **特别关注 `[Auth Callback] Cookies copied to response, count: X` 这一行**
6. 根据日志输出定位问题环节
7. 将完整的日志输出（从后端控制台）复制给我

## Supabase Cookie 配置检查

确保 Supabase 项目设置中：
1. Site URL 配置正确（如 `http://localhost:3000` 或你的生产域名）
2. PostgREST API URL 配置正确
3. JWT expiry 时间足够长（默认 1 小时）
