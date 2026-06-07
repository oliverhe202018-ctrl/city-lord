const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const localTar = path.join(__dirname, 'city-lord-source.tar');
const remoteTar = '/root/city-lord-source.tar';
const projectDir = '/root/city-lord';

const deployScript = `
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
nvm use 20 || echo "NVM use failed, using system node"
if ! command -v node > /dev/null; then
    echo "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
npm config set registry https://registry.npmmirror.com

if ! command -v pm2 > /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
fi

echo "Extracting project..."
mkdir -p ${projectDir}
tar -xf ${remoteTar} -C ${projectDir}

cd ${projectDir} || exit 1

echo 'Installing dependencies and building...'
npm install
npx prisma generate
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
  conn.sftp((err, sftp) => {
    if (err) throw err;
    console.log('SFTP :: starting upload (103MB, this may take a minute or two)...');
    
    // Check if .env.local exists, and push it as well after tar
    sftp.fastPut(localTar, remoteTar, {
      step: (total_transferred, chunk, total) => {
        const mb = (total_transferred / 1024 / 1024).toFixed(2);
        process.stdout.write('\\rUploaded ' + mb + ' MB');
      }
    }, (err) => {
      if (err) throw err;
      console.log('\\nSFTP :: upload complete');
      
      const envLocalPath = path.join(__dirname, '.env.local');
      if (fs.existsSync(envLocalPath)) {
        sftp.fastPut(envLocalPath, projectDir + '/.env', (err) => {
           if(err) console.log('Env upload skipped or failed');
           executeDeploy();
        });
      } else {
        executeDeploy();
      }
    });
  });

  function executeDeploy() {
      console.log('Starting deployment script on remote...');
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
  }
}).connect({
  host: '180.97.221.225',
  port: 22,
  username: 'root',
  password: 'jUOr9jM709qx'
});
