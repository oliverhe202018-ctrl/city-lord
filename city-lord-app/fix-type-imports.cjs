const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    if (fs.statSync(dirPath).isDirectory()) {
      walk(dirPath, callback);
    } else {
      if (dirPath.endsWith('.tsx') || dirPath.endsWith('.ts')) {
        callback(dirPath);
      }
    }
  });
}

walk('./src', (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Replace `import { type X }` with `import { X }` for all identifiers
  // that are likely React Components (start with uppercase)
  content = content.replace(/import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]([^'"]+)['"]/g, (match, importsStr, modulePath) => {
    // Only modify if it's importing from components, contexts, or known UI libs
    if (
        modulePath.includes('/components/') || 
        modulePath.includes('/contexts/') || 
        modulePath === 'sonner' || 
        modulePath === 'vaul' || 
        modulePath === 'cmdk' || 
        modulePath === 'input-otp' ||
        modulePath === 'react-router-dom'
    ) {
      // Remove 'type ' before any uppercase word in the import list
      const fixedImports = importsStr.split(',').map(s => {
        let trimmed = s.trim();
        if (trimmed.startsWith('type ')) {
          let name = trimmed.substring(5).trim();
          if (/^[A-Z]/.test(name)) {
            return name;
          }
        }
        return trimmed;
      }).join(', ');
      return `import { ${fixedImports} } from '${modulePath}'`;
    }
    return match;
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed types in: ${filePath}`);
  }
});
