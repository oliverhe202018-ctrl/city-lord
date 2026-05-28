const { Client } = require('ssh2');

const CONFIG = {
    host: '66.63.168.31',
    port: 22,
    username: 'root',
    password: 'fL3CR5brL91sI0b7Vs'
};

function connectSSH() {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        conn.on('ready', () => {
            console.log('[SSH] Connection established.');
            resolve(conn);
        }).on('error', (err) => {
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
        console.log(`\n--- Executing: ${cmd} ---`);
        conn.exec(cmd, (err, stream) => {
            if (err) return reject(err);
            let stdout = '';
            let stderr = '';
            stream.on('close', (code, signal) => {
                resolve({ code, stdout, stderr });
            }).on('data', (data) => {
                stdout += data.toString();
                process.stdout.write(data.toString());
            }).stderr.on('data', (data) => {
                stderr += data.toString();
                process.stderr.write(data.toString());
            });
        });
    });
}

async function main() {
    const conn = await connectSSH();
    try {
        // 1. Check PM2 status
        await runRemoteCommand(conn, 'pm2 list');

        // 2. Check PM2 logs (last 20 lines)
        await runRemoteCommand(conn, 'pm2 logs city-lord --lines 20 --raw --no-colors --exit');

        // 3. Check local Next.js response
        await runRemoteCommand(conn, 'curl -I http://localhost:3000');

        // 4. Check Nginx systemd status
        await runRemoteCommand(conn, 'systemctl status nginx --no-pager');

        // 5. Check Redis systemd status
        await runRemoteCommand(conn, 'systemctl status redis-server --no-pager');

        // 6. Check Swap space
        await runRemoteCommand(conn, 'free -h');

    } catch (err) {
        console.error('Verification failed:', err);
    } finally {
        conn.end();
    }
}

main().catch(console.error);
