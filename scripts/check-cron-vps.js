const { Client } = require('ssh2');

const CONFIG = {
    host: '66.63.168.31',
    port: 22,
    username: 'root',
    password: 'fL3CR5brL91sI0b7Vs'
};

function runRemoteCommand(conn, cmd) {
    return new Promise((resolve, reject) => {
        conn.exec(cmd, (err, stream) => {
            if (err) return reject(err);
            let stdout = '';
            let stderr = '';
            stream.on('close', (code, signal) => {
                resolve({ code, stdout, stderr });
            }).on('data', (data) => {
                stdout += data;
            }).stderr.on('data', (data) => {
                stderr += data;
            });
        });
    });
}

async function main() {
    const conn = new Client();
    conn.on('ready', async () => {
        console.log('Connected to VPS.');
        
        console.log('Removing immutable/append-only attributes...');
        await runRemoteCommand(conn, 'chattr -ia /var/spool/cron/crontabs/root');

        console.log('Re-running deploy-crons.sh...');
        const res = await runRemoteCommand(conn, 'APP_URL="https://cl1.6543666.xyz" CRON_SECRET="aaa021300" bash /var/www/city-lord/deploy-crons.sh');
        console.log(res.stdout, res.stderr);

        console.log('Done! (Left the attributes off so future deployments will not fail)');
        conn.end();
    }).connect(CONFIG);
}

main().catch(console.error);
