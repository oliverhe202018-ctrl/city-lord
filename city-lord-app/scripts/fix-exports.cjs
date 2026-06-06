const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ansiRegex = new RegExp('[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))', 'g');

function stripAnsi(string) {
  return typeof string === 'string' ? string.replace(ansiRegex, '') : string;
}

function run() {
  try {
    console.log('Running vite build...');
    execSync('npm run build', { stdio: 'pipe' });
    console.log('Build succeeded!');
  } catch (err) {
    let output = (err.stdout ? err.stdout.toString() : '') + (err.stderr ? err.stderr.toString() : '');
    output = stripAnsi(output);
    
    // The error format from rolldown is:
    // [MISSING_EXPORT] "TabType" is not exported by "src/components/citylord/bottom-nav.tsx".
    //    ╭─[ src/components/game/game-page-content.tsx:6:21 ]
    const regex = /\[MISSING_EXPORT\]\s+"([^"]+)"\s+is not exported by[^╭]*╭─\[\s*([^:]+):(\d+):\d+\s*\]/gs;
    let match;
    let changes = 0;
    
    while ((match = regex.exec(output)) !== null) {
      const exportName = match[1];
      const filePath = path.join('d:/project/city-lord-app', match[2].trim());
      const lineNum = parseInt(match[3]) - 1;
      
      if (fs.existsSync(filePath)) {
        const lines = fs.readFileSync(filePath, 'utf8').split('\n');
        if (lines[lineNum] && lines[lineNum].includes(exportName)) {
          console.log(`Found ${exportName} in ${filePath} at line ${lineNum + 1}`);
          if (!lines[lineNum].includes('type ' + exportName) && !lines[lineNum].includes('import type')) {
            lines[lineNum] = lines[lineNum].replace(new RegExp('\\b' + exportName + '\\b'), 'type ' + exportName);
            fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
            console.log(` -> Changed to: ${lines[lineNum].trim()}`);
            changes++;
          }
        }
      }
    }
    
    console.log('Fixed ' + changes + ' exports.');
    if (changes > 0) run();
    else console.log(output.substring(0, 2000));
  }
}

run();
