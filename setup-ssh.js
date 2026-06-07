const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const pubKeyPath = path.join(process.env.USERPROFILE, '.ssh', 'id_rsa.pub');
const pubKey = fs.readFileSync(pubKeyPath, 'utf8');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(`mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo "${pubKey.trim()}" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
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
  password: process.argv[2]
});
