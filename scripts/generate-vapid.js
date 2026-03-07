import webPush from 'web-push';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_PATH = path.join(__dirname, '../.env');

const keys = webPush.generateVAPIDKeys();

console.log('--- VAPID KEYS GENERATED ---');
console.log('Public Key:', keys.publicKey);
console.log('Private Key:', keys.privateKey);
console.log('----------------------------');

let envContent = '';
if (fs.existsSync(ENV_PATH)) {
    envContent = fs.readFileSync(ENV_PATH, 'utf-8');
}

if (!envContent.includes('VAPID_PUBLIC_KEY')) {
    envContent += `
VAPID_PUBLIC_KEY=${keys.publicKey}
`;
}
if (!envContent.includes('VAPID_PRIVATE_KEY')) {
    envContent += `
VAPID_PRIVATE_KEY=${keys.privateKey}
`;
}

fs.writeFileSync(ENV_PATH, envContent);
console.log('Keys saved to .env');
