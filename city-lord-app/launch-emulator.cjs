const { execSync } = require('child_process');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    const adbPath = '"C:\\Users\\a2515\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe"';
    console.log('Waiting for emulator to connect...');
    
    // Wait for device to be detected
    try {
        execSync(`${adbPath} wait-for-device`, { stdio: 'inherit' });
    } catch (e) {}

    console.log('Waiting for boot completion...');
    let booted = false;
    for (let i = 0; i < 120; i++) {
        try {
            const out = execSync(`${adbPath} shell getprop sys.boot_completed`).toString().trim();
            if (out === '1') {
                booted = true;
                break;
            }
        } catch (e) {}
        await sleep(2000);
    }

    if (!booted) {
        console.error('Emulator did not boot in time.');
        process.exit(1);
    }

    console.log('Emulator booted successfully.');

    const apkPath = 'd:\\project\\city-lord-app\\android\\app\\build\\outputs\\apk\\debug\\app-debug.apk';
    console.log(`Installing APK from ${apkPath}...`);
    try {
        execSync(`${adbPath} install -r "${apkPath}"`, { stdio: 'inherit' });
        console.log('Install successful.');
    } catch (e) {
        console.error('Failed to install APK:', e.message);
        process.exit(1);
    }

    console.log('Launching app...');
    try {
        execSync(`${adbPath} shell monkey -p com.citylord.app -c android.intent.category.LAUNCHER 1`, { stdio: 'inherit' });
        console.log('App launched successfully.');
    } catch (e) {
        console.error('Failed to launch app:', e.message);
        process.exit(1);
    }
}

run();
