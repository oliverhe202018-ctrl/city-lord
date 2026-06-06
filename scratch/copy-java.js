const fs = require('fs');
const path = require('path');

const srcDir = 'd:/project/city-lord/android/app/src/main/java/com/xiangfei/citylord';
const destDir = 'd:/project/city-lord-app/android/app/src/main/java/com/citylord/app';

function copyRecursive(src, dest) {
    if (fs.statSync(src).isDirectory()) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        fs.readdirSync(src).forEach(child => {
            copyRecursive(path.join(src, child), path.join(dest, child));
        });
    } else {
        // Read file as UTF-8 string, replace, write back as UTF-8 (no BOM)
        let content = fs.readFileSync(src, 'utf8');
        
        // Remove BOM if present (just in case)
        if (content.charCodeAt(0) === 0xFEFF) {
            content = content.slice(1);
        }
        
        const newContent = content.replace(/com\.xiangfei\.citylord/g, 'com.citylord.app');
        fs.writeFileSync(dest, newContent, 'utf8');
        console.log('Copied and adjusted:', path.relative(destDir, dest));
    }
}

// Clean target directory
if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
}
fs.mkdirSync(destDir, { recursive: true });

copyRecursive(srcDir, destDir);
console.log('Java copy completed successfully!');
