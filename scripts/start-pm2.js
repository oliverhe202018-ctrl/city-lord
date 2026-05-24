const { Client } = require('ssh2');

const CONFIG = {
    host: '66.63.168.31',
    port: 22,
    username: 'root',
    password: 'R67PQUyiceW0rC85q1'
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
        // Stop any existing city-lord process
        await runRemoteCommand(conn, 'pm2 delete city-lord || true');
        
        // Start Next.js via PM2
        await runRemoteCommand(conn, 'cd /var/www/city-lord && pm2 start npm --name "city-lord" -- run start -- -p 3000');
        
        // Wait 3 seconds
        await new Promise(r => setTimeout(r, 3000));
        
        // Show status
        await runRemoteCommand(conn, 'pm2 status');
        
        // Check logs
        await runRemoteCommand(conn, 'pm2 logs city-lord --lines 30 --raw --exit || pm2 logs city-lord --lines 30 --raw');
        
        // Check local port
        await runRemoteCommand(conn, 'curl -I http://localhost:3000');
    } catch (err) {
        console.error('Execution failed:', err);
    } finally {
        conn.end();
    }
}

main().catch(console.error);
