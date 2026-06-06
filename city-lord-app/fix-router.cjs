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

walk('./src', (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Replace `usePathname` from `react-router-dom` with `useLocation`
  if (content.includes('usePathname')) {
    content = content.replace(/usePathname/g, 'useLocation');
    content = content.replace(/const pathname = useLocation\(\)/g, 'const pathname = useLocation().pathname');
  }

  // Replace `router.refresh()` with `window.location.reload()`
  if (content.includes('router.refresh()')) {
    content = content.replace(/router\.refresh\(\)/g, 'window.location.reload()');
  }

  // Replace `[router` with `[navigate` in useEffect deps (common mistake)
  if (content.includes('[router')) {
    content = content.replace(/\[router/g, '[navigate');
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed router in: ${filePath}`);
  }
});
