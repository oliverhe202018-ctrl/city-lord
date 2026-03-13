const { execSync } = require('child_process'); try { console.log(execSync('npx prisma db push', { encoding: 'utf8' })); } catch (err) { console.error('ERROR:\n' + err.message); }
