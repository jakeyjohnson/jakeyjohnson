// Builds the demo page from the app's own page: same markup, plus the bridge that stands in for the server.
// Run: node demo/build.mjs  → demo/index.html, published with the files in public/ alongside it.
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const body = src.slice(src.indexOf('<body>') + 6, src.indexOf('</body>'))
  .replace('<script type="module" src="app.js"></script>', '<script type="module" src="bridge.js"></script>');
const page = `<title>KobiKraken Show Builder</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="demo.css">
${body.trim()}
`;
writeFileSync(new URL('./index.html', import.meta.url), page);
console.log('Built demo/index.html');
