// The password that unlocks this copy. licence.json (next to server.js) holds the licence number and a
// scrypt hash of the password, never the password itself. With no licence.json the app runs unlocked.
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function makeLock(password, licence) {
  const salt = randomBytes(16).toString('hex');
  return { licence, salt, hash: scryptSync(String(password), salt, 32).toString('hex') };
}

export function checkPassword(lock, password) {
  if (!lock) return true;
  const want = Buffer.from(lock.hash, 'hex');
  const got = scryptSync(String(password ?? ''), lock.salt, want.length);
  return timingSafeEqual(got, want);
}

// What the page sends with every request once unlocked. It comes from the stored hash, so a remembered
// unlock still works after the app restarts, and changes when the password does.
export function tokenFor(lock) {
  return lock ? createHash('sha256').update(`kk-unlock:${lock.hash}`).digest('hex') : null;
}

export function tokenMatches(lock, token) {
  if (!lock) return true;
  const want = Buffer.from(tokenFor(lock));
  const got = Buffer.from(String(token || ''));
  return got.length === want.length && timingSafeEqual(got, want);
}

export function loadLock(dir) {
  try { return JSON.parse(readFileSync(join(dir, 'licence.json'), 'utf8')); } catch { return null; }
}
