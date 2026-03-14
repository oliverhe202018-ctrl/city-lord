const { execSync } = require('child_process');
const fs = require('fs');

const log = execSync('git log --oneline cb73bdb..bd6177c', { encoding: 'utf-8' });
const diff = execSync('git diff --name-status cb73bdb..bd6177c', { encoding: 'utf-8' });

fs.writeFileSync('diff-output.json', JSON.stringify({ log: log.split('\n').filter(Boolean), diff: diff.split('\n').filter(Boolean) }, null, 2));
console.log('Done');
