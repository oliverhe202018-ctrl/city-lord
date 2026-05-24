const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// VPS credentials from user request
const CONFIG = {
    host: '66.63.168.31',
    port: 22,
    username: 'root',
    password: 'R67PQUyiceW0rC85q1',
    domain: 'cl1.4567666.xyz',
    remotePath: '/var/www/city-lord'
};

function runLocalCommand(cmd) {
    console.log(`[Local] Running: ${cmd}`);
    try {
        execSync(cmd, { stdio: 'inherit' });
    } catch (e) {
        console.error(`[Local] Command failed: ${cmd}`, e.message);
        throw e;
    }
}

function connectSSH() {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        conn.on('ready', () => {
            console.log('[SSH] Connection established successfully.');
            resolve(conn);
        }).on('error', (err) => {
            console.error('[SSH] Connection error:', err);
            reject(err);
        }).connect({
            host: CONFIG.host,
            port: CONFIG.port,
            username: CONFIG.username,
            password: CONFIG.password
        });
    });
}

function runRemoteCommand(conn, cmd) {
    return new Promise((resolve, reject) => {
        console.log(`[Remote] Executing: ${cmd}`);
        conn.exec(cmd, (err, stream) => {
            if (err) return reject(err);
            let stdout = '';
            let stderr = '';
            stream.on('close', (code, signal) => {
                if (code !== 0) {
                    reject(new Error(`Command failed with code ${code}. Stderr: ${stderr}`));
                } else {
                    resolve(stdout);
                }
            }).on('data', (data) => {
                const chunk = data.toString();
                stdout += chunk;
                process.stdout.write(chunk);
            }).stderr.on('data', (data) => {
                const chunk = data.toString();
                stderr += chunk;
                process.stderr.write(chunk);
            });
        });
    });
}

function uploadFile(conn, localFile, remoteFile) {
    return new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => {
            if (err) return reject(err);
            console.log(`[SFTP] Uploading ${localFile} to ${remoteFile}...`);
            sftp.fastPut(localFile, remoteFile, {}, (err) => {
                if (err) return reject(err);
                console.log(`[SFTP] Upload complete.`);
                resolve();
            });
        });
    });
}

async function main() {
    const rootDir = path.resolve(__dirname, '..');
    const tarFile = path.join(rootDir, 'release.tar.gz');

    // 1. Pack code locally
    console.log('--- Step 1: Packaging local code ---');
    if (fs.existsSync(tarFile)) {
        fs.unlinkSync(tarFile);
    }
    // Using Windows/Linux compatible tar command
    runLocalCommand(`tar -czf release.tar.gz --exclude=node_modules --exclude=.next --exclude=.git --exclude=android --exclude=ios --exclude=release.tar.gz .`);

    // 2. Connect to VPS
    console.log('--- Step 2: Connecting to VPS ---');
    const conn = await connectSSH();

    try {
        // 3. Initialize VPS dependencies
        console.log('--- Step 3: Initializing VPS dependencies ---');
        
        // Disable interactive frontend prompting during apt-get
        const envPrefix = 'export DEBIAN_FRONTEND=noninteractive && ';

        console.log('Checking/Installing updates & dependencies...');
        await runRemoteCommand(conn, `${envPrefix}apt-get update`);
        await runRemoteCommand(conn, `${envPrefix}apt-get install -y curl wget git build-essential redis-server nginx`);

        // Check node version
        let hasNode20 = false;
        try {
            const nodeVer = await runRemoteCommand(conn, 'node -v');
            if (nodeVer.startsWith('v20.')) {
                hasNode20 = true;
                console.log(`Node.js version ${nodeVer.trim()} is already installed.`);
            }
        } catch (e) {
            console.log('Node.js not installed or incompatible.');
        }

        if (!hasNode20) {
            console.log('Installing Node.js v20...');
            await runRemoteCommand(conn, `curl -fsSL https://deb.nodesource.com/setup_20.x | bash -`);
            await runRemoteCommand(conn, `${envPrefix}apt-get install -y nodejs`);
            const nodeVer = await runRemoteCommand(conn, 'node -v');
            console.log(`Node.js installed: ${nodeVer.trim()}`);
        }

        // Install PM2
        console.log('Installing PM2...');
        await runRemoteCommand(conn, 'npm install -g pm2');

        // Configure Redis to run and start on boot
        console.log('Configuring Redis...');
        await runRemoteCommand(conn, 'systemctl enable redis-server && systemctl start redis-server');

        // Configure Swap Space to prevent Out of Memory crashes on low-end VPS
        console.log('Checking swap space...');
        const swapInfo = await runRemoteCommand(conn, 'free -g');
        const swapLines = swapInfo.split('\n');
        let totalSwapGb = 0;
        for (const line of swapLines) {
            if (line.trim().startsWith('Swap:')) {
                const parts = line.trim().split(/\s+/);
                totalSwapGb = parseInt(parts[1], 10) || 0;
            }
        }
        console.log(`Current Swap: ${totalSwapGb} GB`);
        if (totalSwapGb < 4) {
            const extraGb = 4 - totalSwapGb;
            console.log(`Swap space is ${totalSwapGb}GB, which is less than 4GB. Creating an extra ${extraGb}GB swap file (/extra_swapfile)...`);
            try {
                await runRemoteCommand(conn, 'swapoff /extra_swapfile');
            } catch (e) {
                // Ignore if it doesn't exist
            }
            await runRemoteCommand(conn, `fallocate -l ${extraGb}G /extra_swapfile || dd if=/dev/zero of=/extra_swapfile bs=1M count=${extraGb * 1024}`);
            await runRemoteCommand(conn, 'chmod 600 /extra_swapfile');
            await runRemoteCommand(conn, 'mkswap /extra_swapfile');
            await runRemoteCommand(conn, 'swapon /extra_swapfile');
            
            const fstab = await runRemoteCommand(conn, 'cat /etc/fstab');
            if (!fstab.includes('/extra_swapfile')) {
                await runRemoteCommand(conn, 'echo "/extra_swapfile none swap sw 0 0" >> /etc/fstab');
            }
            console.log('Extra swap file created and activated.');
        } else {
            console.log('Swap space is already 4GB or more.');
        }

        // Create remote folder
        console.log(`Creating remote directory ${CONFIG.remotePath}...`);
        await runRemoteCommand(conn, `mkdir -p ${CONFIG.remotePath}`);

        // 4. Upload Files
        console.log('--- Step 4: Uploading code and environment variables ---');
        
        // Upload release.tar.gz
        await uploadFile(conn, tarFile, `${CONFIG.remotePath}/release.tar.gz`);

        // Create .env on server
        // We will read local .env and .env.local, combine them, update NEXT_PUBLIC_API_SERVER, and upload it
        console.log('Preparing production .env file...');
        let prodEnvContent = '';
        if (fs.existsSync(path.join(rootDir, '.env'))) {
            prodEnvContent += fs.readFileSync(path.join(rootDir, '.env'), 'utf8') + '\n';
        }
        if (fs.existsSync(path.join(rootDir, '.env.local'))) {
            prodEnvContent += fs.readFileSync(path.join(rootDir, '.env.local'), 'utf8') + '\n';
        }

        // Ensure NEXT_PUBLIC_API_SERVER is set to our production domain
        // Remove existing NEXT_PUBLIC_API_SERVER lines and append the correct one
        prodEnvContent = prodEnvContent.replace(/^NEXT_PUBLIC_API_SERVER=.*$/gm, '');
        prodEnvContent += `\nNEXT_PUBLIC_API_SERVER=https://${CONFIG.domain}\n`;
        // Ensure REDIS_URL points to local redis if we want, or keep redislabs.
        // The user has a redislabs instance configured in .env.local. We'll keep it, but add a fallback comment.
        prodEnvContent += `\n# LOCAL_REDIS_URL=redis://127.0.0.1:6379\n`;

        const tempEnvPath = path.join(rootDir, '.env.production.temp');
        fs.writeFileSync(tempEnvPath, prodEnvContent, 'utf8');

        // Upload .env
        await uploadFile(conn, tempEnvPath, `${CONFIG.remotePath}/.env`);
        fs.unlinkSync(tempEnvPath);

        // 5. Unpack and Build
        console.log('--- Step 5: Unpacking and building project on VPS ---');
        await runRemoteCommand(conn, `cd ${CONFIG.remotePath} && tar -xzf release.tar.gz && rm -f release.tar.gz`);
        
        console.log('Installing project dependencies...');
        await runRemoteCommand(conn, `cd ${CONFIG.remotePath} && npm install`);

        console.log('Generating Prisma Client...');
        await runRemoteCommand(conn, `cd ${CONFIG.remotePath} && npx prisma generate`);

        console.log('Building Next.js application...');
        await runRemoteCommand(conn, `cd ${CONFIG.remotePath} && NODE_OPTIONS="--max-old-space-size=2048" npm run build`);

        // 6. PM2 Process Launch
        console.log('--- Step 6: Starting Next.js app via PM2 ---');
        await runRemoteCommand(conn, `cd ${CONFIG.remotePath} && (pm2 reload city-lord || pm2 start npm --name "city-lord" -- run start -- -p 3000)`);
        await runRemoteCommand(conn, 'pm2 save');
        // Setup pm2 startup script if not done
        try {
            await runRemoteCommand(conn, 'pm2 startup | tail -n 1 | bash');
        } catch (e) {
            console.log('PM2 startup setup completed or skipped (non-fatal).');
        }

        // 7. Nginx Proxy Configuration
        console.log('--- Step 7: Configuring Nginx Reverse Proxy ---');
        const nginxConfig = `
server {
    listen 80;
    server_name ${CONFIG.domain};

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
`;
        const tempNginxPath = path.join(rootDir, 'nginx.temp');
        fs.writeFileSync(tempNginxPath, nginxConfig, 'utf8');
        await uploadFile(conn, tempNginxPath, '/etc/nginx/sites-available/city-lord');
        fs.unlinkSync(tempNginxPath);

        await runRemoteCommand(conn, 'ln -sf /etc/nginx/sites-available/city-lord /etc/nginx/sites-enabled/');
        await runRemoteCommand(conn, 'rm -f /etc/nginx/sites-enabled/default');
        await runRemoteCommand(conn, 'nginx -t');
        await runRemoteCommand(conn, 'systemctl restart nginx');

        // 8. Certbot SSL Configuration
        console.log('--- Step 8: Configuring SSL with Certbot ---');
        await runRemoteCommand(conn, `${envPrefix}apt-get install -y certbot python3-certbot-nginx`);
        // Ask certbot to run non-interactively
        await runRemoteCommand(conn, `certbot --nginx -d ${CONFIG.domain} --non-interactive --agree-tos -m citylord-admin@4567666.xyz`);
        await runRemoteCommand(conn, 'systemctl reload nginx');

        console.log('\n=========================================');
        console.log('Deployment completed successfully!');
        console.log(`Application is live at: https://${CONFIG.domain}`);
        console.log('=========================================');

    } catch (err) {
        console.error('Deployment execution failed:', err);
    } finally {
        conn.end();
        // Clean up tar file
        if (fs.existsSync(tarFile)) {
            fs.unlinkSync(tarFile);
            console.log('Cleaned up local release.tar.gz');
        }
    }
}

main().catch(console.error);
