// Ad-hoc signs each built app (Apple Silicon won't open a broken signature; packaging breaks Electron's),
// verifies, re-zips. codesign on macOS, rcodesign (RCODESIGN=path) elsewhere.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('./dist/', import.meta.url).pathname;
const { version, productName } = JSON.parse(
  execFileSync('node', ['-p', 'JSON.stringify(require("./package.json"))'], { encoding: 'utf8' }),
);
const onMac = process.platform === 'darwin';
const rcodesign = process.env.RCODESIGN || 'rcodesign';

for (const dir of readdirSync(dist).filter((d) => /^mac/.test(d))) {
  const arch = dir === 'mac' ? 'x64' : dir.replace('mac-', '');
  const app = join(dist, dir, `${productName}.app`);
  if (!existsSync(app)) continue;
  if (onMac) {
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
    execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
  } else {
    execFileSync(rcodesign, ['sign', app], { stdio: ['ignore', 'ignore', 'inherit'] });
    // rcodesign verify is unreliable (per its docs); check the main executable has the ad-hoc sig instead
    const info = execFileSync(
      rcodesign,
      ['print-signature-info', join(app, 'Contents', 'MacOS', productName)],
      { encoding: 'utf8' },
    );
    if (!/ADHOC/.test(info)) throw new Error(`${app} didn't get an ad-hoc signature`);
  }
  const zip = join(dist, `KobiKraken-Show-Builder-${version}-${arch}.zip`);
  rmSync(zip, { force: true });
  rmSync(`${zip}.blockmap`, { force: true });
  // keep the framework symlinks as symlinks (-y), or the app won't start
  execFileSync(
    onMac ? 'ditto' : 'zip',
    onMac ? ['-c', '-k', '--keepParent', app, zip] : ['-qry', zip, `${productName}.app`],
    { cwd: join(dist, dir), stdio: 'inherit' },
  );
  console.log(`Signed and zipped ${arch}: ${zip}`);
}
