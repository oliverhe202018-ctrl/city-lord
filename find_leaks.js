const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    if (dir.includes('node_modules') || dir.includes('.next') || dir.includes('.git')) return;

    let files;
    try {
        files = fs.readdirSync(dir);
    } catch (e) { return; }

    for (const f of files) {
        const dirPath = path.join(dir, f);
        let stat;
        try {
            stat = fs.statSync(dirPath);
        } catch (e) { continue; }

        if (stat.isDirectory()) {
            walkDir(dirPath, callback);
        } else {
            callback(dirPath);
        }
    }
}

const step1 = [];
const step4 = [];

walkDir('.', (filePath) => {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return;
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
        // Step 1: from '@prisma/client'
        if (line.includes("from '@prisma/client'")) {
            step1.push(`${filePath.replace(/\\\\/g, '/')}:${i + 1}:${line.trim()}`);
        }
        // Step 4: process.env (but NOT NEXT_PUBLIC)
        if (line.includes('process.env') && !line.includes('NEXT_PUBLIC')) {
            step4.push(`${filePath.replace(/\\\\/g, '/')}:${i + 1}:${line.trim()}`);
        }
    });
});

fs.writeFileSync('step1.txt', step1.join('\n'));
fs.writeFileSync('step4.txt', step4.join('\n'));
console.log('Search complete.');
