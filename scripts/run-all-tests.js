const { execSync } = require('child_process');
const fs = require('fs');

const runTest = (name, envProps) => {
    let out = `\n\n================ ${name} ================\n`;
    const env = { ...process.env, ...envProps };
    try {
        const output = execSync('npx tsx scripts/test-phase2b2a-penalty.ts', { env, stdio: 'pipe' });
        out += output.toString();
    } catch (e) {
        out += e.stdout ? e.stdout.toString() : e.message;
        out += e.stderr ? '\nSTDERR:\n' + e.stderr.toString() : '';
    }
    return out;
};

let finalLog = '';

finalLog += runTest('Scenario A: Enabled & Zero-Reward Enabled', {
    FF_TERRITORY_ABUSE_PENALTY_ENABLED: 'true',
    FF_TERRITORY_ABUSE_PENALTY_ZERO_REWARD_ENABLED: 'true',
    FF_TERRITORY_ABUSE_PENALTY_MIN_FLIPS: '3',
    FF_TERRITORY_ABUSE_PENALTY_LOOKBACK_HOURS: '24',
    FF_TERRITORY_ABUSE_PENALTY_ALLOW_USER_IDS: ''
});

finalLog += runTest('Scenario B: Disabled', {
    FF_TERRITORY_ABUSE_PENALTY_ENABLED: 'false',
    FF_TERRITORY_ABUSE_PENALTY_ZERO_REWARD_ENABLED: 'true',
    FF_TERRITORY_ABUSE_PENALTY_MIN_FLIPS: '3',
    FF_TERRITORY_ABUSE_PENALTY_LOOKBACK_HOURS: '24',
    FF_TERRITORY_ABUSE_PENALTY_ALLOW_USER_IDS: ''
});

finalLog += runTest('Scenario C: Not-in-Allowlist', {
    FF_TERRITORY_ABUSE_PENALTY_ENABLED: 'true',
    FF_TERRITORY_ABUSE_PENALTY_ZERO_REWARD_ENABLED: 'true',
    FF_TERRITORY_ABUSE_PENALTY_MIN_FLIPS: '3',
    FF_TERRITORY_ABUSE_PENALTY_LOOKBACK_HOURS: '24',
    FF_TERRITORY_ABUSE_PENALTY_ALLOW_USER_IDS: 'some-other-uuid'
});

fs.writeFileSync('scripts/test-results.txt', finalLog);
console.log('Done running all tests. Results saved to scripts/test-results.txt');
