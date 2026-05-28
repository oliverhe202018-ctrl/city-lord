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
        await runRemoteCommand(conn, 'ps -p 11977 -o pid,%cpu,%mem,cmd,etime,stat || echo "Process not found"');
        await runRemoteCommand(conn, 'ls -la /var/www/city-lord/.next/ || echo "No .next folder"');
        await runRemoteCommand(conn, 'ls -la /var/www/city-lord/.next/server/ || echo "No server folder"');
        await runRemoteCommand(conn, 'pm2 status');
        await runRemoteCommand(conn, 'free -h');
    } catch (err) {
        console.error('Debug failed:', err);
    } finally {
        conn.end();
    }
}

main().catch(console.error);
