const fs = require('fs');
const path = require('path');

const FORBIDDEN_IMPORTS = [
  '@amap/amap-jsapi-loader'
];

const ALLOWED_FILES = [
  'lib/map/safe-amap.ts'
];

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  let hasError = false;

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (file === 'node_modules' || file === '.next' || file === '.git') continue;
      if (scanDir(fullPath)) hasError = true;
    } else {
      if (!EXTENSIONS.includes(path.extname(file))) continue;
      
      // Skip allowed files
      if (ALLOWED_FILES.some(allowed => relativePath.endsWith(allowed))) continue;

      const content = fs.readFileSync(fullPath, 'utf-8');
      
      for (const forbidden of FORBIDDEN_IMPORTS) {
        if (content.includes(forbidden)) {
          // Double check it's an import/require
          const importRegex = new RegExp(`(import.*from|require\\()\\s*['"]${forbidden}['"]`);
          if (importRegex.test(content)) {
            console.error(`❌ Dangerous import detected in ${relativePath}: ${forbidden}`);
            console.error(`   Please use 'lib/map/safe-amap.ts' instead.`);
            hasError = true;
          }
        }
      }
    }
  }
  return hasError;
}

const args = process.argv.slice(2);
const isStaged = args.includes('--staged');

if (isStaged) {
  // Check only staged files (would need git diff --cached --name-only)
  // For simplicity in this script, we just scan everything or rely on lint-staged passing file list
  // But usually lint-staged passes filenames as arguments.
  
  // If arguments contain file paths (not starting with --), verify those.
  const filesToCheck = args.filter(arg => !arg.startsWith('--'));
  
  if (filesToCheck.length > 0) {
      let hasError = false;
      for (const file of filesToCheck) {
          const relativePath = path.relative(process.cwd(), file).replace(/\\/g, '/');
          if (ALLOWED_FILES.some(allowed => relativePath.endsWith(allowed))) continue;
          
          if (fs.existsSync(file)) {
             const content = fs.readFileSync(file, 'utf-8');
             for (const forbidden of FORBIDDEN_IMPORTS) {
                const importRegex = new RegExp(`(import.*from|require\\()\\s*['"]${forbidden}['"]`);
                if (importRegex.test(content)) {
                    console.error(`❌ Dangerous import detected in ${relativePath}: ${forbidden}`);
                    console.error(`   Please use 'lib/map/safe-amap.ts' instead.`);
                    hasError = true;
                }
             }
          }
      }
      if (hasError) process.exit(1);
  } else {
      // Fallback to full scan if no files provided
      if (scanDir(process.cwd())) {
        process.exit(1);
      }
  }
} else {
  if (scanDir(process.cwd())) {
    process.exit(1);
  }
}

console.log('✅ Import safety check passed.');
