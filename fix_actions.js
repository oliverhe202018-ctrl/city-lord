const fs = require('fs');
const path = require('path');

const dir = 'app/actions';
if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
      if (!file.endsWith('.ts')) return;
      const filePath = path.join(dir, file);
      let content = fs.readFileSync(filePath, 'utf8');
      if (content.includes("'use server'")) {
        content = content.replace(/'use server'/g, "// 'use server'");
        fs.writeFileSync(filePath, content);
        console.log(`Updated ${file}`);
      }
    });
}
