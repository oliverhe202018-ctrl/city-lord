const { Client } = require('ssh2');

const nginxConfig = `
server {
    listen 80;
    server_name cl1.6543666.xyz;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`;

const setupScript = `
if ! command -v nginx > /dev/null; then
    echo "Installing Nginx..."
    apt-get update && apt-get install -y nginx
fi

echo "Configuring Nginx..."
cat << 'EOF' > /etc/nginx/sites-available/city-lord
${nginxConfig}
EOF

ln -sf /etc/nginx/sites-available/city-lord /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

echo "Restarting Nginx..."
systemctl restart nginx

echo "Checking PM2 status..."
pm2 status
curl -s http://127.0.0.1:3000 > /dev/null && echo "Port 3000 is locally accessible" || echo "Port 3000 is NOT locally accessible!"
`;

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(setupScript, { pty: true }, (err, stream) => {
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
