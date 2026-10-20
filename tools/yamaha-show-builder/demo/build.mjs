// Builds the demo page from the app's own page: same markup, plus the bridge that stands in for the server.
// The web demo has no app server, so it skips the lock screen and goes straight into demo mode.
// Run: node demo/build.mjs  → demo/index.html, published with the files in public/ alongside it.
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const open = /<body[^>]*>/.exec(src);
const body = src.slice(open.index + open[0].length, src.indexOf('</body>'))
  .replace('<script type="module" src="boot.js"></script>', '<script type="module" src="demo-bridge.js"></script>');
const page = `<title>KobiKraken Show Builder</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="style.css">
${body.trim()}
`;
writeFileSync(new URL('./index.html', import.meta.url), page);
console.log('Built demo/index.html');
