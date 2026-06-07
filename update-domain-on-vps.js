const { Client } = require('ssh2');

const script = `
echo "Updating Nginx configuration..."
sed -i 's/cl1.4567666.xyz/cl1.6543666.xyz/g' /etc/nginx/sites-available/city-lord
systemctl restart nginx

echo "Updating project files..."
cd /root/city-lord || exit 1
# Update typescript, javascript, bash, markdown, json files
find . -type d \\( -name "node_modules" -o -name ".next" -o -name ".git" -o -name "android" -o -name "ios" -o -name "dist" \\) -prune -o -type f -exec sed -i 's/cl1.4567666.xyz/cl1.6543666.xyz/g' {} +

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
nvm use 20 || echo "NVM use failed, using system node"

echo "Rebuilding project..."
npm run build

echo "Restarting PM2 service..."
pm2 restart city-lord

echo "Domain update and redeploy complete!"
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
