const { Client } = require('ssh2');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env.local or .env
const envLocalPath = path.join(__dirname, '../.env.local');
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

const vpsHost = process.env.VPS_HOST || 'cl1.4567666.xyz';
const vpsUser = process.env.VPS_USER || 'root';
const vpsPassword = process.env.VPS_PASSWORD;
const vpsProjectPath = '/root/city-lord';

if (!vpsPassword) {
    console.error('\x1b[31m[ERROR] VPS_PASSWORD is not set in your .env or .env.local file.\x1b[0m');
    console.error('Please add: VPS_PASSWORD=your_root_password to your .env file.');
    process.exit(1);
}

console.log('\x1b[36m========================================\x1b[0m');
console.log('\x1b[36m City Lord - VPS Auto Deploy Script\x1b[0m');
console.log('\x1b[36m========================================\x1b[0m');

try {
    console.log('\n\x1b[33m[1/3] Pushing latest code to GitHub...\x1b[0m');
    execSync('git add .', { stdio: 'inherit' });
    try {
        execSync('git commit -m "Auto-deploy update"', { stdio: 'inherit' });
    } catch (e) {
        // Ignore "nothing to commit" errors
    }
    execSync('git push origin main', { stdio: 'inherit' });
    console.log('\x1b[32m[OK] Code pushed to remote repository\x1b[0m');
} catch (error) {
    console.error('\x1b[31m[ERROR] Failed to push code to GitHub.\x1b[0m');
    process.exit(1);
}

console.log(`\n\x1b[33m[2/3] Connecting to VPS (${vpsUser}@${vpsHost})...\x1b[0m`);

const deployCommands = `
set -e
if [ ! -d "${vpsProjectPath}" ]; then
    echo "=================================================="
    echo "First time deployment detected!"
    echo "Cloning repository into ${vpsProjectPath}..."
    echo "=================================================="
    git clone https://github.com/oliverhe202018-ctrl/city-lord.git ${vpsProjectPath}
    cd ${vpsProjectPath}
else
    cd ${vpsProjectPath}
    echo 'Pulling latest code...'
    git pull origin main
fi

if [ ! -f ".env" ]; then
    echo "=================================================="
    echo "WARNING: .env file is missing in ${vpsProjectPath}!"
    echo "Please create the .env file with your database"
    echo "and Supabase credentials before running the app."
    echo "=================================================="
    [ -f ".env.example" ] && cp .env.example .env
fi

echo 'Installing dependencies and building...'
npm install
npx prisma generate
export NODE_OPTIONS="--max-old-space-size=2048"
export NEXT_PRIVATE_MAX_WORKERS=1
npm run build

echo 'Restarting PM2 service...'
pm2 describe city-lord > /dev/null 2>&1
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
    console.log('\x1b[32m[OK] Connected to VPS!\x1b[0m');
    console.log('\x1b[33m[3/3] Executing deployment commands...\x1b[0m\n');
    
    conn.exec(deployCommands, (err, stream) => {
        if (err) throw err;
        
        stream.on('close', (code, signal) => {
            if (code === 0) {
                console.log('\n\x1b[32m[SUCCESS] Server deployment and restart completed successfully!\x1b[0m');
            } else {
                console.error(`\n\x1b[31m[ERROR] Deployment script failed with exit code ${code}\x1b[0m`);
            }
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).on('error', (err) => {
    console.error('\x1b[31m[ERROR] SSH Connection failed:\x1b[0m', err.message);
    process.exit(1);
}).connect({
    host: vpsHost,
    port: 22,
    username: vpsUser,
    password: vpsPassword
});
