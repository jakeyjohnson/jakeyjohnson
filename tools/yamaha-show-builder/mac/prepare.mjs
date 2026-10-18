// Copies the Show Builder (server, bridge and page) into app/ so the Mac app ships the same code as `npm start`.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = fileURLToPath(new URL('./bundle/', import.meta.url));
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of ['server.js', 'desk-link.js', 'discover.js', 'rf-link.js']) cpSync(root + f, out + f);
cpSync(root + 'public', out + 'public', { recursive: true });
console.log('Copied the app into mac/bundle');
