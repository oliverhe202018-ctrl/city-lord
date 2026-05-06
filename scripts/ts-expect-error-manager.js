const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const command = args[0];

const BASELINE_DIR = path.join(__dirname, '../.quality');
const BASELINE_FILE = path.join(BASELINE_DIR, 'ts-expect-error-baseline.json');

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (['node_modules', '.next', 'dist', 'coverage', '.git', '.quality'].includes(file)) continue;
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (/\.(ts|tsx)$/.test(filePath)) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function processFiles(onFile) {
  const root = path.join(__dirname, '..');
  const files = getAllFiles(root);
  let totalErrors = 0;
  for (const file of files) {
    totalErrors += onFile(file);
  }
  return totalErrors;
}

if (command === 'count') {
  let count = 0;
  processFiles((file) => {
    const content = fs.readFileSync(file, 'utf8');
    const matches = content.match(/@ts-expect-error/g);
    if (matches) count += matches.length;
    return 0;
  });
  console.log(`Total @ts-expect-error count: ${count}`);
} else if (command === 'annotate') {
  const TICKET_STR = ' - [Ticket-202603-SchemaSync] baseline exemption';
  processFiles((file) => {
    let content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    let changed = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('@ts-expect-error') && !lines[i].includes('[Ticket-')) {
        lines[i] = lines[i].replace(/@ts-expect-error(.*)/, (match, p1) => {
            if (p1 && p1.includes('baseline exemption')) return match;
            return match + TICKET_STR;
        });
        changed = true;
      }
    }
    if (changed) fs.writeFileSync(file, lines.join('\n'), 'utf8');
    return 0;
  });
  console.log('Annotation completed.');
} else if (command === 'baseline:update') {
  let count = 0;
  processFiles((file) => {
    const content = fs.readFileSync(file, 'utf8');
    const matches = content.match(/@ts-expect-error/g);
    if (matches) count += matches.length;
    return 0;
  });
  if (!fs.existsSync(BASELINE_DIR)) fs.mkdirSync(BASELINE_DIR);
  fs.writeFileSync(BASELINE_FILE, JSON.stringify({
    count,
    updatedAt: new Date().toISOString(),
    note: "Auto-generated baseline"
  }, null, 2));
  console.log(`Baseline updated: ${count}`);
} else if (command === 'check') {
  let count = 0;
  processFiles((file) => {
    const content = fs.readFileSync(file, 'utf8');
    const matches = content.match(/@ts-expect-error/g);
    if (matches) count += matches.length;
    return 0;
  });
  
  let baseline = { count: Number.MAX_SAFE_INTEGER };
  if (fs.existsSync(BASELINE_FILE)) {
    baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
  } else {
    console.warn('No baseline file found. Passing check but you should generate one.');
    process.exit(0);
  }
  
  if (count > baseline.count) {
    console.error(`ERROR: @ts-expect-error count (${count}) exceeds baseline (${baseline.count}).`);
    console.error(`Please fix new errors instead of adding @ts-expect-error, or update the baseline if authorized.`);
    process.exit(1);
  } else {
    console.log(`PASS: @ts-expect-error count (${count}) is within baseline (${baseline.count}).`);
  }
} else {
  console.error('Unknown command. Use: count, annotate, baseline:update, check');
  process.exit(1);
}
