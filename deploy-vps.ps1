$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "City Lord - VPS Auto Deploy Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`n[1/3] Pushing latest code to GitHub..." -ForegroundColor Yellow
git add .
git commit -m "Auto-deploy: Update API endpoints and mobile auth support"
git push origin main
Write-Host "[OK] Code pushed to remote repository" -ForegroundColor Green

$vpsHost = "root@cl1.4567666.xyz"
$vpsProjectPath = "/root/city-lord" 

$deployCommands = @"
cd $vpsProjectPath || exit 1
echo 'Pulling latest code...'
git pull origin main

echo 'Installing dependencies and building...'
npm install
npm run build

echo 'Restarting PM2 service...'
pm2 restart city-lord || pm2 restart all

echo 'Deployment complete!'
"@

Write-Host "`n[2/3] Connecting to VPS..." -ForegroundColor Yellow
Write-Host "Note: If prompted, please enter your VPS SSH password." -ForegroundColor Gray

ssh $vpsHost $deployCommands

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[3/3] Server deployment and restart completed successfully!" -ForegroundColor Green
} else {
    Write-Host "`n[ERROR] Deployment failed. Please check SSH connection or VPS environment." -ForegroundColor Red
}

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
