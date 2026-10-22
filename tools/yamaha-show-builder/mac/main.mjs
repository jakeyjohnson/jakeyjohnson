// Electron shell: runs the server on 127.0.0.1 and shows the page in its own window.
import { readFile } from 'node:fs/promises';
import { app, BrowserWindow, Menu, dialog, shell } from 'electron';
import { startServer } from './bundle/server.js';

// Fixed port: saved show and templates are stored per origin
const PORTS = [47820, 47821, 47822, 47823, 47824];
let server = null;
let win = null;
let pendingFile = null; // a .kk opened from Finder before the page was ready

// The page picks the file up in app.js (window.kkOpenFile), or later if it's still on the lock screen
function sendFile(b64) {
  const data = JSON.stringify(b64);
  win.webContents.executeJavaScript(
    `window.kkOpenFile ? window.kkOpenFile(${data}) : (window.kkPendingFile = ${data}); void 0`,
  );
  win.focus();
}
async function openFile(path) {
  if (!/\.(kk|json)$/i.test(path)) return;
  let b64;
  try {
    b64 = (await readFile(path)).toString('base64');
  } catch (err) {
    dialog.showErrorBox("Couldn't open that show", err.message);
    return;
  }
  if (!win || win.webContents.isLoading()) pendingFile = b64;
  else sendFile(b64);
}
app.on('open-file', (e, path) => {
  e.preventDefault();
  openFile(path);
});

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

async function start() {
  for (const port of PORTS) {
    try {
      return await startServer({ port, host: '127.0.0.1' });
    } catch (err) {
      if (err.code !== 'EADDRINUSE') throw err;
    }
  }
  throw new Error(
    `Ports ${PORTS[0]}–${PORTS.at(-1)} are all in use. Close the other app using them and open Show Builder again.`,
  );
}

function createWindow() {
  const home = `http://127.0.0.1:${server.port}/`;
  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#11151a',
    title: 'KobiKraken Show Builder',
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.on('did-finish-load', () => {
    if (pendingFile) sendFile(pendingFile);
    pendingFile = null;
  });
  // Paperwork in its own window, web links in the browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(home) || url.startsWith('blob:') || url === 'about:blank')
      return {
        action: 'allow',
        overrideBrowserWindowOptions: { width: 900, height: 1000, backgroundColor: '#ffffff' },
      };
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(home)) {
      e.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });
  win.on('closed', () => {
    win = null;
  });
  win.loadURL(home);
}

function buildMenu() {
  const template = [
    { role: 'appMenu' },
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Show…',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const { canceled, filePaths } = await dialog.showOpenDialog(win, {
              filters: [{ name: 'KobiKraken show', extensions: ['kk', 'json'] }],
              properties: ['openFile'],
            });
            if (!canceled && filePaths[0]) openFile(filePaths[0]);
          },
        },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
  try {
    server = await start();
  } catch (err) {
    dialog.showErrorBox("Show Builder can't start", err.message);
    app.quit();
    return;
  }
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (!win) createWindow();
  });
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => server?.close());
