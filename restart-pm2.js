const { Client } = require('ssh2');

const script = `
cd /root/city-lord
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
nvm use 20

# We must use npm start directly to load env variables properly, or pass them to pm2
pm2 delete city-lord
npm run start:pm2 || pm2 start npm --name "city-lord" -- run start
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
