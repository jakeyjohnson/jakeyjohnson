// Gives each built app an ad-hoc code signature (Apple Silicon won't open an app whose signature is broken,
// and packaging changes Electron's), checks it, then re-zips it. Uses Apple's codesign on a Mac and
// rcodesign (set RCODESIGN to its path) anywhere else.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('./dist/', import.meta.url).pathname;
const { version, productName } = JSON.parse(execFileSync('node', ['-p', 'JSON.stringify(require("./package.json"))'], { encoding: 'utf8' }));
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
    // rcodesign's own verify is unreliable (it says so), so check the main executable carries the ad-hoc signature
    const info = execFileSync(rcodesign, ['print-signature-info', join(app, 'Contents', 'MacOS', productName)], { encoding: 'utf8' });
    if (!/ADHOC/.test(info)) throw new Error(`${app} didn't get an ad-hoc signature`);
  }
  const zip = join(dist, `KobiKraken-Show-Builder-${version}-${arch}.zip`);
  rmSync(zip, { force: true });
  rmSync(`${zip}.blockmap`, { force: true });
  // keep the framework symlinks as symlinks (-y), or the app won't start
  execFileSync(onMac ? 'ditto' : 'zip', onMac ? ['-c', '-k', '--keepParent', app, zip] : ['-qry', zip, `${productName}.app`], { cwd: join(dist, dir), stdio: 'inherit' });
  console.log(`Signed and zipped ${arch}: ${zip}`);
}
