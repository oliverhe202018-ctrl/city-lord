# Vercel 部署指南 - City Lord

本指南将帮助你将 City Lord (城市领主) 游戏前端部署到 [Vercel](https://vercel.com/)。

## 1. 准备工作

在部署之前，请确保你已经准备好了以下环境变量。你需要将它们添加到 Vercel 的项目设置中。

### 必需的环境变量

| 变量名 | 说明 | 示例值 |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL | `https://your-project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名 API 密钥 | `eyJhbGciOiJIUzI1NiIsInR5c...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务端管理员密钥 (用于验证码登录) | `eyJhbGciOiJIUzI1NiIsInR5c...` (不要泄露给客户端) |
| `NEXT_PUBLIC_AMAP_KEY` | 高德地图 Web 端 (JS API) Key | `a1b2c3d4e5f6...` |
| `NEXT_PUBLIC_AMAP_SECURITY_CODE` | 高德地图安全密钥 (Web 服务) | `f6e5d4c3b2a1...` |

> **注意**: 
> 1. 高德地图的 Security Code 是必需的，因为本项目使用了 JS API Loader。
> 2. `SUPABASE_SERVICE_ROLE_KEY` 是必需的，因为本项目使用了自定义的“验证码登录”流程，需要后端管理员权限来校验用户。请在 Supabase Dashboard -> Project Settings -> API -> Service Role Secret 中找到它。

## 2. 部署步骤

### 方法 A: 使用 Vercel Dashboard (推荐)

1.  **推送代码**: 将你的代码推送到 GitHub、GitLab 或 Bitbucket 仓库。
2.  **导入项目**: 登录 Vercel Dashboard，点击 "Add New..." -> "Project"，然后选择你的仓库。
3.  **配置构建**:
    *   **Framework Preset**: 选择 `Next.js` (Vercel 会自动检测)。
    *   **Root Directory**: 保持默认 `./`。
    *   **Build Command**: `next build` (默认)。
    *   **Output Directory**: `.next` (默认)。
    *   **Install Command**: `npm install` (或 `yarn`, `pnpm install`，Vercel 会自动检测)。
4.  **配置环境变量**:
    *   展开 **Environment Variables** 选项卡。
    *   依次添加上述 4 个必需的环境变量。
5.  **点击 Deploy**: 等待构建完成，Vercel 会自动分配一个 `*.vercel.app` 的域名。

### 方法 B: 使用 Vercel CLI

如果你更喜欢命令行操作：

1.  安装 Vercel CLI: `npm i -g vercel`
2.  在项目根目录运行: `vercel`
3.  按照提示登录并关联项目。
4.  在询问 "Want to modify these settings?" 时，选择 `N` (使用默认设置)。
5.  部署完成后，去 Vercel Dashboard 配置环境变量，然后触发重新部署 (`vercel --prod`)。

## 3. 常见问题排查

### 部署失败：Build Error
如果遇到构建错误，请检查 `npm run build` 是否在本地能通过。常见原因：
*   **TypeScript 错误**: 默认情况下，Next.js 在构建时会检查类型。如果有 TS 报错，构建会失败。
    *   *临时解决方案*: 在 `next.config.mjs` 中添加 `typescript: { ignoreBuildErrors: true }` (不推荐用于生产)。
*   **ESLint 错误**: 同样，Lint 错误也会阻止构建。
    *   *临时解决方案*: 在 `next.config.mjs` 中添加 `eslint: { ignoreDuringBuilds: true }`。

### 运行时：地图不显示
*   检查 `NEXT_PUBLIC_AMAP_KEY` 和 `NEXT_PUBLIC_AMAP_SECURITY_CODE` 是否配置正确。
*   确认高德控制台中的 Key 类型是否为 **Web端 (JS API)**。
*   检查浏览器控制台是否有 `AMap is not defined` 或 403 错误。

### 运行时：Supabase 连接失败
*   检查 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 是否正确。
*   确认 Supabase 项目的 Row Level Security (RLS) 策略是否允许你的操作。

## 4. 后续优化
*   **自定义域名**: 在 Vercel Settings -> Domains 中绑定你自己的域名。
*   **Analytics**: 可以在 Vercel 开启 Analytics 查看访问数据。
