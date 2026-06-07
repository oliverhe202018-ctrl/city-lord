const fs = require('fs');
const path = require('path');

const oldDomain = 'cl1.4567666.xyz';
const newDomain = 'cl1.6543666.xyz';

const files = [
  'AGENTS.md',
  'build-apk.sh',
  'capacitor.config.ts',
  'check-nginx.js',
  'city-lord-app/capacitor.config.ts',
  'city-lord-app/src/api/client.ts',
  'city-lord-app/src/lib/api.ts',
  'city-lord-app/src/lib/api/client.ts',
  'city-lord-app/src/lib/fetch-shim.ts',
  'city-lord-app/vite.config.ts',
  'install-nginx.js',
  'lib/api/client.ts',
  'middleware.ts',
  'scratch/test-rpc.js',
  'scripts/check-cron-vps.js',
  'scripts/deploy-to-vps.js',
  'scripts/deploy.js',
  'setup-ssl.js'
];

for (const file of files) {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(oldDomain)) {
      content = content.split(oldDomain).join(newDomain);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${file}`);
    }
  }
}
