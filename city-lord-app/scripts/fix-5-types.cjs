const fs = require('fs');
const path = require('path');

const typesToFix = ['TabType', 'MapHeaderProps', 'AMapViewHandle', 'ViewportKingData', 'Database'];

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('d:/project/city-lord-app/src');
let changedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  
  typesToFix.forEach(t => {
    // Look for `import { ... t ... }`
    // We can just use a simple regex replacing `\bt\b` inside an import with `type t`
    // But safely: only if it's not already `type t` or `import type`
    
    // Split into lines
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ') && lines[i].includes(t)) {
        if (!lines[i].includes('type ' + t) && !lines[i].includes('import type')) {
          lines[i] = lines[i].replace(new RegExp('\\b' + t + '\\b'), 'type ' + t);
          changed = true;
        }
      }
    }
    if (changed) {
      content = lines.join('\n');
    }
  });
  
  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    changedCount++;
    console.log('Fixed ' + file);
  }
});

console.log('Fixed ' + changedCount + ' files.');
