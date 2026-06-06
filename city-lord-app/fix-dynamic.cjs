const fs = require('fs');
const path = require('path');

const reactLazyPolyfill = `import { Suspense, lazy } from 'react';
const dynamic = (importFunc, options = {}) => {
  const LazyComponent = lazy(() => importFunc().then((mod) => ({
    default: mod.default || Object.values(mod)[0]
  })));
  return (props) => (
    <Suspense fallback={options.loading ? options.loading() : null}>
      <LazyComponent {...props} />
    </Suspense>
  );
};`;

const nextDynamicPolyfill = reactLazyPolyfill.replace('const dynamic', 'const nextDynamic');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf-8');
            if (content.includes("from 'next/dynamic'") || content.includes('from "next/dynamic"')) {
                content = content.replace(/import\s+(\w+)\s+from\s+['"]next\/dynamic['"];?/g, (match, name) => {
                    if (name === 'dynamic') {
                        return reactLazyPolyfill;
                    } else if (name === 'nextDynamic') {
                        return nextDynamicPolyfill;
                    }
                    return reactLazyPolyfill;
                });
                fs.writeFileSync(fullPath, content, 'utf-8');
                console.log(`Fixed ` + fullPath);
            }
        }
    }
}

processDir('d:/project/city-lord-app/src');
