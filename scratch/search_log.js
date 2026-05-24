const fs = require('fs');

const logPath = 'C:\\Users\\a2515\\.gemini\\antigravity\\brain\\a863c525-1172-448b-89d5-4fc015c6fee8\\.system_generated\\tasks\\task-1950.log';
try {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  console.log(`Total lines: ${lines.length}`);
  const lastLines = lines.slice(-50);
  lastLines.forEach((m, idx) => console.log(`${lines.length - 50 + idx}: ${m}`));
} catch (e) {
  console.error('Error reading log:', e.message);
}
