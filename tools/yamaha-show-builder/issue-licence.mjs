// Issues licence keys: short SB- by default, --long for a KK1- key signed with
// ~/.kobikraken/kobikraken-licence-private.pem (or KK_PRIVATE_KEY). Logged to ~/.kobikraken/licences.csv.
//
//   node issue-licence.mjs --name "Acme Audio"                     next free licence number, never ends
//   node issue-licence.mjs --name "Acme Audio" --expires 2027-12-31  ends on that day
//   node issue-licence.mjs --name "Jakey Johnson" --serial 1         a particular licence number
//   node issue-licence.mjs --name "Acme Audio" --long               a long signed key
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { checkKey, licenceNumber, makeKey, makeShortKey } from './lock.js';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .join(' ')
    .split(/\s*--/)
    .filter(Boolean)
    .map((a) => {
      const [k, ...v] = a.split(' ');
      return [k, v.join(' ').replace(/^"|"$/g, '') || true];
    }),
);
const dir = join(homedir(), '.kobikraken');
const keyFile = process.env.KK_PRIVATE_KEY || join(dir, 'kobikraken-licence-private.pem');
const ledger = join(dir, 'licences.csv');
if (args.long && !existsSync(keyFile)) {
  console.error(
    `Can't find the private key at ${keyFile}. Put kobikraken-licence-private.pem there, or set KK_PRIVATE_KEY.`,
  );
  process.exit(1);
}
const issued = existsSync(ledger)
  ? readFileSync(ledger, 'utf8')
      .trim()
      .split('\n')
      .slice(1)
      .map((l) => Number(l.split(',')[0]))
  : [];
const serial = Number(args.serial) || Math.max(0, ...issued) + 1;
if (issued.includes(serial)) {
  console.error(
    `${licenceNumber(serial)} has already been issued. Leave out --serial to use the next free number.`,
  );
  process.exit(1);
}
if (args.expires && !/^\d{4}-\d{2}-\d{2}$/.test(args.expires)) {
  console.error('Write --expires as a date, like 2027-12-31.');
  process.exit(1);
}
const key = args.long
  ? makeKey({ serial, expires: args.expires || null }, readFileSync(keyFile, 'utf8'))
  : makeShortKey({ serial, expires: args.expires || null });
const check = checkKey(key);
if (!check.ok)
  throw new Error(
    `The new key didn't check out: ${check.error}.${args.long ? ' Is the private key the right one?' : ''}`,
  );
check.issued ||= new Date().toISOString().slice(0, 10);
mkdirSync(dir, { recursive: true });
if (!existsSync(ledger)) appendFileSync(ledger, 'serial,licence,name,issued,expires,key\n');
appendFileSync(
  ledger,
  `${serial},${check.licence},"${(args.name || '').replace(/"/g, "'")}",${check.issued},${check.expires || 'never'},${key}\n`,
);
console.log(
  `${check.licence} for ${args.name || 'unnamed'}${check.expires ? `, ends ${check.expires}` : ''}\n\n${key}\n`,
);
