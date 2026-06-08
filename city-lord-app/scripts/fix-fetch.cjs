const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('d:/project/city-lord/city-lord-app/src');
let changedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  if (content.includes('return await fetch(url, { ...init, signal: controller.signal })')) {
    content = content.replace(
      'return await fetch(url, { ...init, signal: controller.signal })',
      'return await apiFetch(url, { ...init, signal: controller.signal })'
    );
    changed = true;
  }
  
  if (content.includes('return await fetch(url, { ...restInit, signal: combinedSignal });')) {
    content = content.replace(
      'return await fetch(url, { ...restInit, signal: combinedSignal });',
      'return await apiFetch(url, { ...restInit, signal: combinedSignal });'
    );
    changed = true;
  }

  if (changed) {
    if (!content.includes('import { apiFetch }')) {
      content = `import { apiFetch } from '@/lib/fetch-shim';\n` + content;
    }
    fs.writeFileSync(file, content);
    changedCount++;
    console.log('Fixed ' + file);
  }
});

console.log('Total fixed: ' + changedCount);
