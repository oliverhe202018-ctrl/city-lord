const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const REQUIRED_ENV_VARS = ['DATABASE_URL'];
const PRISMA_SCHEMA_PATH = path.join(__dirname, '../prisma/schema.prisma');
const NODE_MODULES_PATH = path.join(__dirname, '../node_modules');

// Helper to run commands
function runCommand(command, ignoreError = false) {
  try {
    console.log(`\n> Executing: ${command}`);
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    if (!ignoreError) {
      console.error(`\nX Command failed: ${command}`);
      console.error(error.message);
      process.exit(1);
    }
    console.warn(`\n! Command failed (ignored): ${command}`);
    return false;
  }
}

// 1. Check Environment Variables
console.log('Validating environment variables...');
const envPath = path.join(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
  console.error('X .env file not found!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const missingVars = REQUIRED_ENV_VARS.filter(v => !envContent.includes(`${v}=`));

if (missingVars.length > 0) {
  console.error(`X Missing environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}
console.log('✓ Environment variables check passed.');

// 2. Cleanup & EPERM Handling
console.log('\nChecking for EPERM issues and cleaning up...');
// Try to clean cache if needed, but for now just ensure node_modules is accessible logic could be here
// On Windows, sometimes verified via trying to write a tmp file
try {
  const tmpFile = path.join(NODE_MODULES_PATH, '.tmp_check');
  if (fs.existsSync(NODE_MODULES_PATH)) {
      fs.writeFileSync(tmpFile, 'check');
      fs.unlinkSync(tmpFile);
  }
} catch (e) {
    console.error('X EPERM detected in node_modules. Please close any processes (VSCode, etc) using these files.');
    // Attempting to kill node processes (aggressive, but requested to handle EPERM)
    // runCommand('taskkill /F /IM node.exe', true); 
    // Commented out to avoid killing *this* process if running via node, but user requested cleaning.
    console.warn('! Please manually stop other Node.js processes if permission errors persist.');
}

// 3. Database Sync
console.log('\nSynchronizing database...');
// Prioritize code repo version -> db push --accept-data-loss
runCommand('npx prisma db push --accept-data-loss --schema="' + PRISMA_SCHEMA_PATH + '"');

// 4. Generate Client
console.log('\nGenerating Prisma Client...');
runCommand('npx prisma generate --schema="' + PRISMA_SCHEMA_PATH + '"');

console.log('\n✓ Environment fix completed successfully!');
