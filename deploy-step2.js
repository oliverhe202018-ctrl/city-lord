const { Client } = require('ssh2');

const deployScript = `
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
nvm use 20 || echo "NVM use failed, using system node"
npm config set registry https://registry.npmmirror.com

cd /root/city-lord || exit 1

echo 'Installing dependencies (ignoring scripts to bypass sharp libvips error)...'
npm install --ignore-scripts

echo 'Generating Prisma client...'
npx --yes prisma generate

echo 'Building project...'
npm run build

echo 'Restarting PM2 service...'
pm2 describe city-lord > /dev/null
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
  console.log('Client :: ready');
  console.log('Starting deployment step 2 script on remote...');
  conn.exec(deployScript, { pty: true }, (err, stream) => {
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
