const fs = require('fs');
const path = require('path');

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
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ') && lines[i].includes('{')) {
      if (lines[i].includes('lucide-react')) continue; // Skip icons
      if (lines[i].includes('react')) continue; // Skip React hooks
      
      const match = lines[i].match(/\{([^}]+)\}/);
      if (match) {
        const imports = match[1].split(',').map(s => s.trim()).filter(s => s.length > 0);
        const newImports = imports.map(imp => {
          // If starts with uppercase and doesn't already have 'type '
          if (/^[A-Z]/.test(imp) && !imp.startsWith('type ')) {
            changed = true;
            return 'type ' + imp;
          }
          return imp;
        });
        
        if (changed) {
          lines[i] = lines[i].replace(match[0], '{ ' + newImports.join(', ') + ' }');
        }
      }
    }
  }
  
  if (changed) {
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
    changedCount++;
  }
});

console.log('Fixed uppercase types in ' + changedCount + ' files.');
