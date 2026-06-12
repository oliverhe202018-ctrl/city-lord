$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "City Lord - VPS Auto Deploy Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`n[1/3] Pushing latest code to GitHub..." -ForegroundColor Yellow
git add .
git commit -m "Auto-deploy: Update VPS configuration"
git push origin main
Write-Host "[OK] Code pushed to remote repository" -ForegroundColor Green

$vpsHost = "root@180.97.221.225"
$vpsProjectPath = "/root/city-lord" 

$deployCommands = @'
export NVM_DIR="$HOME/.nvm"
if [ ! -d "$NVM_DIR" ]; then
    echo "Installing NVM..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 20
nvm use 20

if ! command -v pm2 > /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
fi

if ! command -v git > /dev/null; then
    echo "Installing Git..."
    apt-get update && apt-get install -y git
fi

vpsProjectPath="/root/city-lord"
if [ ! -d "$vpsProjectPath" ]; then
    echo "=================================================="
    echo "First time deployment detected!"
    echo "Cloning repository into $vpsProjectPath..."
    echo "=================================================="
    git clone https://github.com/oliverhe202018-ctrl/city-lord.git $vpsProjectPath || exit 1
    cd $vpsProjectPath
else
    cd $vpsProjectPath || exit 1
    echo 'Pulling latest code...'
    git pull origin main
fi

if [ ! -f ".env" ]; then
    echo "=================================================="
    echo "WARNING: .env file is missing in $vpsProjectPath!"
    echo "Please create the .env file with your database"
    echo "and Supabase credentials before running the app."
    echo "=================================================="
    [ -f ".env.example" ] && cp .env.example .env
fi

echo 'Installing dependencies and building...'
proxychains4 -q npm install
npx prisma generate
npm run build

echo 'Restarting PM2 service...'
pm2 describe city-lord > /dev/null
if [ $? -eq 0 ]; then
    pm2 restart city-lord
else
    echo 'Starting new PM2 instance...'
    pm2 start npm --name "city-lord" -- run start
    pm2 save
fi

echo 'Deployment complete!'
'@
$deployCommands = $deployCommands -replace "`r`n", "`n"

Write-Host "`n[2/3] Connecting to VPS on Port 2222..." -ForegroundColor Yellow
Write-Host "Note: If prompted, please enter your VPS SSH password." -ForegroundColor Gray

ssh -p 2222 $vpsHost $deployCommands

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[3/3] Server deployment and restart completed successfully!" -ForegroundColor Green
} else {
    Write-Host "`n[ERROR] Deployment failed. Please check SSH connection or VPS environment." -ForegroundColor Red
}

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
