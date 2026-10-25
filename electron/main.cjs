'use strict';

const { app, BrowserWindow, shell } = require('electron');

const DEFAULT_CRM_URL = 'https://crm-sicoven.vercel.app';
const CRM_URL = process.env.CRM_DESKTOP_URL || DEFAULT_CRM_URL;
let mainWindow;

function isTrustedUrl(rawUrl) {
  try {
    const candidate = new URL(rawUrl);
    const trusted = new URL(CRM_URL);
    return candidate.origin === trusted.origin;
  } catch {
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 650,
    title: 'CRM SICOVEN',
    autoHideMenuBar: true,
    backgroundColor: '#f3f6fa',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedUrl(url)) {
      event.preventDefault();
      if (url.startsWith('https://') || url.startsWith('http://')) {
        void shell.openExternal(url);
      }
    }
  });

  mainWindow.loadURL(CRM_URL);
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.setAppUserModelId('com.efasfreelancer.crm-sicoven');
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
