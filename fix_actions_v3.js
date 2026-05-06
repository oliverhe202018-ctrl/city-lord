const fs = require('fs');
const path = require('path');

// Hardcode the absolute path to be sure
const dir = 'D:\\podcast\\day1\\city-lord-game-interface\\app\\actions';
console.log(`Scanning directory: ${dir}`);

try {
    if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        console.log(`Files found: ${files.length}`);

        files.forEach(file => {
          if (!file.endsWith('.ts')) return;
          const filePath = path.join(dir, file);
          let content = fs.readFileSync(filePath, 'utf8');
          
          // Match 'use server' or "use server"
          const regex = /(['"])use server\1/g;
          
          if (regex.test(content)) {
            console.log(`Found 'use server' in ${file}`);
            content = content.replace(regex, "// $&"); 
            fs.writeFileSync(filePath, content);
            console.log(`Updated ${file}`);
          } else {
            console.log(`No 'use server' in ${file}`);
          }
        });
    } else {
        console.error('Directory not found!');
    }
} catch (e) {
    console.error('Error:', e);
}
