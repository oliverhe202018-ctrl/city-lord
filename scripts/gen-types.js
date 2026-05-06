const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Generating Supabase types securely (bypassing PowerShell stdout corruption)...');

try {
    // Use stdio: ['pipe', 'pipe', 'ignore'] to prevent stderr/progress bars from polluting output
    const output = execSync('npx supabase gen types typescript --project-id eyxlkuvxbihueplaqcbq', {
        stdio: ['pipe', 'pipe', 'ignore'],
        encoding: 'buffer' // Capture as raw buffer to avoid encoding issues
    });

    const outputPath = path.join(__dirname, '../types/supabase.ts');

    // Write explicitly as utf8 avoiding BOM or UTF16le which breaks tsc
    fs.writeFileSync(outputPath, output.toString('utf8'), 'utf8');

    console.log(`Successfully generated and wrote types to ${outputPath}`);
} catch (error) {
    console.error('Failed to generate types:', error.message);
    process.exit(1);
}
