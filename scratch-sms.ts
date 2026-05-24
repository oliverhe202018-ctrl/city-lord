import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    const phone = '17673773888';
    const pushToken = process.env.SPUG_PUSH_TOKEN;
    const code = '123456';
    
    console.log('Sending test SMS to:', phone);
    console.log('SPUG_PUSH_TOKEN:', pushToken);
    
    const payload = {
        to: phone,
        name: '城主大人',
        code: code,
        number: '5',
    };

    const res = await fetch(`https://push.spug.cc/sms/${pushToken}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    console.log('Status:', res.status);
    const resultJson = await res.json();
    console.log('JSON:', resultJson);
}

main().catch(console.error);
