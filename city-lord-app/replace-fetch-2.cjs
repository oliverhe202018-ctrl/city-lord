const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walk(dirPath, callback);
    } else {
      if (dirPath.endsWith('.ts') || dirPath.endsWith('.tsx')) {
        callback(dirPath);
      }
    }
  });
}

let modifiedFiles = 0;

walk('./src', (filePath) => {
  if (filePath.replace(/\\/g, '/').includes('src/lib/fetch-shim')) return;
  if (filePath.replace(/\\/g, '/').includes('src/store/useStore')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Replace fetch(`${process.env.NEXT_PUBLIC_API_SERVER || ''}/api/...`) 
  // with apiFetch(`/api/...`)
  const templateFetchRegex = /\bfetch\s*\(\s*`\$\{process\.env\.NEXT_PUBLIC_API_SERVER \|\| ''\}\/api\//g;
  if (templateFetchRegex.test(content)) {
    content = content.replace(/\bfetch\s*\(\s*`\$\{process\.env\.NEXT_PUBLIC_API_SERVER \|\| ''\}\/api\//g, 'apiFetch(`/api/');
  }

  // Replace const fetcher = (url: string) => fetch(url)... with apiFetch(url)...
  const fetcherRegex = /const fetcher = \(url: string\) => fetch\(url\)/g;
  if (fetcherRegex.test(content)) {
    content = content.replace(/const fetcher = \(url: string\) => fetch\(url\)/g, 'const fetcher = (url: string) => apiFetch(url)');
  }

  if (content !== originalContent) {
    if (!content.includes('import { apiFetch } from')) {
      const importStmt = "import { apiFetch } from '@/lib/fetch-shim';\n";
      const lastImportMatch = [...content.matchAll(/^import .*$/gm)].pop();
      if (lastImportMatch) {
        const insertPos = lastImportMatch.index + lastImportMatch[0].length;
        content = content.slice(0, insertPos) + '\n' + importStmt + content.slice(insertPos);
      } else {
        content = importStmt + content;
      }
    }
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Modified: ${filePath}`);
    modifiedFiles++;
  }
});

console.log(`\nSuccessfully modified ${modifiedFiles} files.`);
