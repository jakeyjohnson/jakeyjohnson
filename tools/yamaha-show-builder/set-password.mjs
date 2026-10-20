// Sets the password that unlocks this copy of Show Builder.
//   node set-password.mjs "your new password"   sets it (at least 8 characters)
//   node set-password.mjs --off                 removes it, so the app opens unlocked
// Only a scrypt hash is stored, in licence.json, with the licence number from public/about.js.
// Rebuild the Mac app afterwards (mac: npm run build) so it carries the new password.
import { rmSync, writeFileSync } from 'node:fs';
import { LICENCE } from './public/about.js';
import { makeLock } from './lock.js';

const file = new URL('./licence.json', import.meta.url);
const arg = process.argv[2];
if (arg === '--off') {
  rmSync(file, { force: true });
  console.log('Password removed. The app opens unlocked.');
} else if (!arg || arg.length < 8) {
  console.error('Give a password of at least 8 characters: node set-password.mjs "your new password"');
  process.exit(1);
} else {
  writeFileSync(file, JSON.stringify(makeLock(arg, LICENCE), null, 2) + '\n');
  console.log(`Password set for licence ${LICENCE}.`);
}
