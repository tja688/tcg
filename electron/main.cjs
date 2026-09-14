const { app, BrowserWindow, Menu, protocol, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const qwen = require('./qwen.cjs');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const APP_ID = 'com.arcaneduel.tcg';
app.setName('奥术对决');
app.setAppUserModelId(APP_ID);

let mainWindow = null;

function distRoot() {
  return path.join(app.getAppPath(), 'dist');
}

function resolveDistFile(requestUrl) {
  const { pathname } = new URL(requestUrl);
  let rel = decodeURIComponent(pathname);
  if (!rel || rel === '/') rel = '/index.html';
  if (rel.endsWith('/')) rel += 'index.html';
  rel = rel.replace(/^[/\\]+/, '');

  const root = path.resolve(distRoot());
  const filePath = path.resolve(root, rel);
  const extra = path.relative(root, filePath);
  if (extra.startsWith('..') || path.isAbsolute(extra)) return null;
  return filePath;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    backgroundColor: '#05030c',
    title: '奥术对决',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  win.once('ready-to-show', () => {
    win.show();
    win.maximize();
  });

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('app://')) event.preventDefault();
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
    if (input.key === 'F12' && !app.isPackaged) {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  win.loadURL('app://localhost/index.html');
  mainWindow = win;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    protocol.handle('app', (request) => {
      if (qwen.isQwenRequest(request.url)) return qwen.proxyQwen(request);
      const filePath = resolveDistFile(request.url);
      if (!filePath) return new Response('Forbidden', { status: 403 });
      return net.fetch(pathToFileURL(filePath).href);
    });
    qwen.ensureSidecar().catch((err) => {
      console.warn(`[qwen] sidecar not started: ${err.message}`);
    });
    createWindow();
  });

  app.on('before-quit', () => {
    qwen.stopSidecar();
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}
