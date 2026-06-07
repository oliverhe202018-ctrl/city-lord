const { Client } = require('ssh2');
const fs = require('fs');

const mid1 = fs.readFileSync('middleware.ts', 'utf8');
const mid2 = fs.readFileSync('lib/supabase/middleware.ts', 'utf8');

const script = `
cat << 'EOF' > /root/city-lord/middleware.ts
${mid1}
EOF

cat << 'EOF' > /root/city-lord/lib/supabase/middleware.ts
${mid2}
EOF

cd /root/city-lord
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
nvm use 20

npm run build
pm2 restart city-lord
`;

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(script, { pty: true }, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code);
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
