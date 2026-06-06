const fs = require('fs');
const path = require('path');

const srcDir = 'd:/project/city-lord-app/src';
const actionsDir = path.join(srcDir, 'app', 'actions');

if (!fs.existsSync(actionsDir)) {
  fs.mkdirSync(actionsDir, { recursive: true });
}

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

const files = walk(srcDir);
const actionImports = {}; // { 'social-hub': Set(['getFeedTimeline', ...]) }

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  // Match `import { a, b, type C } from "@/app/actions/some-file"`
  const regex = /import\s+\{([^}]+)\}\s+from\s+['"]@\/app\/actions\/([^'"]+)['"]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const importsStr = match[1];
    let actionFile = match[2];
    
    if (!actionImports[actionFile]) {
      actionImports[actionFile] = new Set();
    }
    
    // Split imports by comma
    const parts = importsStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
    parts.forEach(p => {
      // Handle `import { type A }`, `A as B`, etc.
      p = p.replace(/^type\s+/, '').trim(); // Remove "type " modifier
      let importName = p;
      if (p.includes(' as ')) {
        importName = p.split(' as ')[0].trim();
      }
      actionImports[actionFile].add(importName);
    });
  }
});

// Generate the proxy files
Object.keys(actionImports).forEach(actionFile => {
  const proxyPath = path.join(actionsDir, actionFile + '.ts');
  const dirName = path.dirname(proxyPath);
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, { recursive: true });
  }
  
  const imports = Array.from(actionImports[actionFile]);
  let fileContent = `import { rpcCall } from '@/api/client';\n\n`;
  
  imports.forEach(imp => {
    // If it starts with uppercase, it's likely a type (e.g. FeedTimelineResponse)
    // We export a dummy type to satisfy the bundler if it was mistakenly imported as value
    if (/^[A-Z]/.test(imp)) {
      fileContent += `export type ${imp} = any;\n`;
    } else {
      fileContent += `export const ${imp} = async (...args: any[]) => rpcCall('${actionFile}', '${imp}', args);\n`;
    }
  });
  
  fs.writeFileSync(proxyPath, fileContent, 'utf8');
  console.log('Generated proxy for ' + actionFile + ' with ' + imports.length + ' exports.');
});
