// KobiKraken Show Builder for Mac: runs the app server inside the app (only this computer can reach it)
// and shows the page in its own window. Nothing to install, no Terminal.
import { app, BrowserWindow, Menu, dialog, shell } from 'electron';
import { startServer } from './bundle/server.js';

// A fixed port keeps the page's saved show and templates between launches (they're stored per address)
const PORTS = [47820, 47821, 47822, 47823, 47824];
let server = null;
let win = null;

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

async function start() {
  for (const port of PORTS) {
    try { return await startServer({ port, host: '127.0.0.1' }); } catch (err) { if (err.code !== 'EADDRINUSE') throw err; }
  }
  throw new Error(`Ports ${PORTS[0]}–${PORTS.at(-1)} are all in use. Close the other app using them and open Show Builder again.`);
}

function createWindow() {
  const home = `http://127.0.0.1:${server.port}/`;
  win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 900, minHeight: 600,
    backgroundColor: '#11151a', title: 'KobiKraken Show Builder', show: false,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  win.once('ready-to-show', () => win.show());
  // Paperwork opens in its own window; web links open in the browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(home) || url.startsWith('blob:') || url === 'about:blank') return { action: 'allow', overrideBrowserWindowOptions: { width: 900, height: 1000, backgroundColor: '#ffffff' } };
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(home)) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  win.on('closed', () => { win = null; });
  win.loadURL(home);
}

function buildMenu() {
  const template = [
    { role: 'appMenu' },
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'reload' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
  try {
    server = await start();
  } catch (err) {
    dialog.showErrorBox('Show Builder can\'t start', err.message);
    app.quit();
    return;
  }
  buildMenu();
  createWindow();
  app.on('activate', () => { if (!win) createWindow(); });
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => server?.close());
