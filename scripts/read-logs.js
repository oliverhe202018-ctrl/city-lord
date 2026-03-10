const fs = require('fs');
['test1.log', 'test2.log', 'test3.log'].forEach(file => {
    try {
        const path = 'scripts/' + file;
        if (fs.existsSync(path)) {
            console.log(`\n\n--- CONTENT OF ${file} ---`);
            const content = fs.readFileSync(path, 'utf8');
            // PowerShell might have written UTF-16 LE
            if (content.charCodeAt(0) === 0xFFFE || content.charCodeAt(0) === 0xFEFF || content.includes('\u0000')) {
                console.log(fs.readFileSync(path, 'utf16le').toString());
            } else {
                console.log(content);
            }
        }
    } catch (e) {
        console.error(e);
    }
});
