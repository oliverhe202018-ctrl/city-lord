const fs = require('fs');
const output = fs.readFileSync('d:/project/city-lord-app/build-error-utf8.log', 'utf8');
const regex = /"([^"]+)" is not exported by/g;
let match;
const s = new Set();
while ((match = regex.exec(output)) !== null) {
  s.add(match[1]);
}
console.log(Array.from(s).join(', '));
