$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🚀 City Lord - VPS 自动化部署脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. 提交本地代码到 GitHub
Write-Host "`n[1/3] 正在将最新代码推送到 GitHub..." -ForegroundColor Yellow
git add .
git commit -m "Auto-deploy: Update API endpoints and mobile auth support"
git push origin main
Write-Host "✅ 代码已成功推送到远程仓库" -ForegroundColor Green

# 2. 准备 SSH 部署命令
$vpsHost = "root@cl1.4567666.xyz"
# 注意：请根据您 VPS 上的实际项目路径修改这里的 /root/city-lord 或 /var/www/city-lord
$vpsProjectPath = "/root/city-lord" 

$deployCommands = @"
cd $vpsProjectPath || { echo '项目目录不存在！请检查路径'; exit 1; }
echo '⬇️ 正在拉取最新代码...'
git pull origin main

echo '📦 正在安装依赖并构建生产环境...'
npm install
npm run build

echo '🔄 正在重启 PM2 服务...'
pm2 restart city-lord || pm2 restart all

echo '✅ 部署完成！'
"@

Write-Host "`n[2/3] 正在连接 VPS 进行热更新..." -ForegroundColor Yellow
Write-Host "注意：如果提示输入密码，请输入您 VPS 的 SSH 密码。" -ForegroundColor Gray

# 3. 执行 SSH 远程命令
ssh $vpsHost $deployCommands

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[3/3] 🎉 服务端代码部署与重启已全部完成！" -ForegroundColor Green
} else {
    Write-Host "`n❌ 部署过程中出现错误，请检查 SSH 连接或 VPS 环境。" -ForegroundColor Red
}

Write-Host "按任意键退出..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
