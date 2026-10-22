// Builds demo/index.html: the app page plus the in-browser stand-in bridge. No server, so no lock screen.
// Run: node demo/build.mjs   (publish alongside public/)
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const open = /<body[^>]*>/.exec(src);
const body = src
  .slice(open.index + open[0].length, src.indexOf('</body>'))
  .replace(
    '<script type="module" src="boot.js"></script>',
    '<script type="module" src="demo-bridge.js"></script>',
  );
const page = `<meta charset="utf-8">
<title>KobiKraken Show Builder</title>
<link rel="stylesheet" href="style.css">
${body.trim()}
`;
writeFileSync(new URL('./index.html', import.meta.url), page);
console.log('Built demo/index.html');
