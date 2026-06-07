const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec(`ufw status && curl -I http://127.0.0.1 && curl -I http://cl1.6543666.xyz`, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
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
