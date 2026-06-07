const fs = require('fs');
const path = require('path');

const adminDir = path.join(__dirname, 'app', 'admin');
const dashboardDir = path.join(adminDir, '(dashboard)');

if (!fs.existsSync(dashboardDir)) {
  fs.mkdirSync(dashboardDir);
}

const items = fs.readdirSync(adminDir);
for (const item of items) {
  if (item === '(dashboard)' || item === 'login') {
    continue;
  }
  
  const oldPath = path.join(adminDir, item);
  const newPath = path.join(dashboardDir, item);
  
  fs.renameSync(oldPath, newPath);
  console.log(`Moved ${item} to (dashboard)`);
}
