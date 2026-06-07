const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec(`ls -la ~/.ssh && cat ~/.ssh/authorized_keys`, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: '180.97.221.225',
  port: 22,
  username: 'root',
  password: 'jUOr9jM709qx'
});
