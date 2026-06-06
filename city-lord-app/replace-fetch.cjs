const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walk(dirPath, callback);
    } else {
      // Only process .ts and .tsx files
      if (dirPath.endsWith('.ts') || dirPath.endsWith('.tsx')) {
        callback(dirPath);
      }
    }
  });
}

let modifiedFiles = 0;

walk('./src', (filePath) => {
  // Skip the apiFetch implementation file
  if (filePath.replace(/\\/g, '/').includes('src/lib/fetch-shim')) return;
  // Skip useStore.ts as we already fixed it
  if (filePath.replace(/\\/g, '/').includes('src/store/useStore')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Replace fetch('/api/...) and fetch("api/...) and fetch(`...
  // with apiFetch(...)
  
  // Regex to match fetch( followed by ' or " or `
  // But be careful not to replace things like myfetch()
  // Look for word boundary or space before fetch
  const fetchRegex = /\bfetch\s*\((['"`])\/?api\//g;
  
  if (fetchRegex.test(content)) {
    // Perform replacement
    content = content.replace(/\bfetch\s*\((['"`])\/?api\//g, 'apiFetch($1/api/');
    
    // Add import statement if not already there
    if (!content.includes('import { apiFetch } from')) {
      // Calculate relative path to src/lib/fetch-shim
      // e.g. from src/components/game/file.tsx -> @/lib/fetch-shim
      // We can just use the absolute alias @/lib/fetch-shim
      const importStmt = "import { apiFetch } from '@/lib/fetch-shim';\n";
      
      // Insert after last import or at top
      const lastImportMatch = [...content.matchAll(/^import .*$/gm)].pop();
      if (lastImportMatch) {
        const insertPos = lastImportMatch.index + lastImportMatch[0].length;
        content = content.slice(0, insertPos) + '\n' + importStmt + content.slice(insertPos);
      } else {
        content = importStmt + content;
      }
    }
  }

  // Also catch generic fetch(url) where url is a variable?
  // We can't safely replace all fetch() calls automatically via regex because some might be native Web APIs fetching remote URLs (like Map tiles or Supabase).
  // But we know 'api/' starts are Next.js routes.
  // What about fetch(`${process.env.NEXT_PUBLIC_URL}/api/...`)?
  // Our apiFetch handles absolute URLs by doing nothing! So it's safe to replace them.
  const templateFetchRegex = /\bfetch\s*\(\s*`/g;
  // We can do a broader replacement later if needed. For now, /api/ is the most common.

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Modified: ${filePath}`);
    modifiedFiles++;
  }
});

console.log(`\nSuccessfully modified ${modifiedFiles} files.`);
