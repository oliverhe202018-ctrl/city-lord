const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const envLocalPath = path.join(__dirname, '.env.local');
const envContent = fs.existsSync(envLocalPath) ? fs.readFileSync(envLocalPath, 'utf8') : '';
const envContentBase64 = Buffer.from(envContent).toString('base64');

const deployScript = `
if ! command -v node > /dev/null; then
    echo "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
npm config set registry https://registry.npmmirror.com

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
    git clone https://mirror.ghproxy.com/https://github.com/oliverhe202018-ctrl/city-lord.git $vpsProjectPath || exit 1
fi

cd $vpsProjectPath || exit 1
git remote set-url origin https://mirror.ghproxy.com/https://github.com/oliverhe202018-ctrl/city-lord.git
echo 'Pulling latest code...'
git pull origin main

echo 'Writing .env file...'
echo "${envContentBase64}" | base64 -d > .env

echo 'Installing dependencies and building...'
npm install
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
`;

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready, starting deployment...');
  conn.exec(deployScript, { pty: true }, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data.toString());
    }).stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  });
}).connect({
  host: '180.97.221.225',
  port: 22,
  username: 'root',
  password: 'jUOr9jM709qx'
});
