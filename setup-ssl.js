const { Client } = require('ssh2');

const setupScript = `
echo "Checking DNS resolution from 8.8.8.8..."
apt-get update && apt-get install -y dnsutils
dig @8.8.8.8 cl1.6543666.xyz +short

echo "Installing Certbot and Nginx plugin..."
apt-get install -y certbot python3-certbot-nginx

echo "Running Certbot for cl1.6543666.xyz..."
certbot --nginx -d cl1.6543666.xyz --non-interactive --agree-tos -m admin@city-lord.com --redirect

echo "Certbot configuration complete. Checking Nginx status..."
systemctl status nginx --no-pager
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
