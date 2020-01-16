const dotenv = require('dotenv');
const crypto = require('crypto');
const fs = require('fs');
const url = require('url');
const path = require('path');
const { app, BrowserWindow, Menu, Notification, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const electronUtils = require('electron-util');
const isDev = require('electron-is-dev');
const logger = require('electron-log');

const { setupTray } = require('./tray');

const NAME = 'Redshape';

const utils = require('./utils');
require('./exceptionCatcher')();

app.setAppUserModelId('app.spring3.redshape');
autoUpdater.logger = logger;
autoUpdater.logger.transports.file.level = 'info';

const configFilePath = isDev
  ? path.join(__dirname, '../.env')
  : path.join(app.getPath('userData'), '.env');

const env = dotenv.config({ silent: true, path: configFilePath });

if (env.error || !process.env.ENCRYPTION_KEY) {
  const key = crypto.randomBytes(32).toString('hex');
  fs.appendFileSync(configFilePath, `ENCRYPTION_KEY=${key}`);
  dotenv.config({ silent: true, path: configFilePath });
}

const config = require('../common/config');
const { PORT } = config;
require('../common/request'); // to initialize from storage

let mainWindow;
let aboutWindow;

const updateSettings = ({ idleBehavior, discardIdleTime, advancedTimerControls, progressWithStep1 }, settings) => {
  if (idleBehavior >= 0){
    settings.idleBehavior = idleBehavior;
    mainWindow.webContents.send('settings', { key: 'IDLE_BEHAVIOR', value: idleBehavior })
  }
  if (discardIdleTime != null){
    settings.discardIdleTime = discardIdleTime;
    mainWindow.webContents.send('settings', { key: 'IDLE_TIME_DISCARD', value: discardIdleTime })
  }
  if (advancedTimerControls != null){
    settings.advancedTimerControls = advancedTimerControls;
    mainWindow.webContents.send('settings', { key: 'ADVANCED_TIMER_CONTROLS', value: advancedTimerControls })
  }
  if (progressWithStep1 != null){
    settings.progressWithStep1 = progressWithStep1;
    mainWindow.webContents.send('settings', { key: 'PROGRESS_SLIDER_STEP_1', value: progressWithStep1 })
  }
  generateMenu({ settings });
}

const generateMenu = ({ settings }) => {
  const isMac = process.platform === 'darwin';
  const aboutSubmenu = {
    label: 'About Redshape',
    click: () => {
      if (!aboutWindow || (aboutWindow instanceof BrowserWindow) === false) {
        createAboutWindow();
      } else {
        aboutWindow.focus();
      }
      aboutWindow.show();
      if (isDev) {
        aboutWindow.webContents.openDevTools();
      }
    }
  };
  const menu = Menu.buildFromTemplate([
    // { role: 'appMenu' }
    ...(isMac ? [{
      label: NAME,
      submenu: [
        aboutSubmenu,
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        ...(!isMac ? [aboutSubmenu] : []),
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
          { type: 'separator' },
          {
            label: 'Speech',
            submenu: [
              { role: 'startspeaking' },
              { role: 'stopspeaking' }
            ]
          }
        ] : [
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' }
        ])
      ]
    },
    // { role: 'viewMenu' }
    ...(isDev
        ? [{
          label: 'View',
          submenu: [
            { role: 'reload' },
            { role: 'forcereload' },
            { role: 'toggledevtools' },
            { type: 'separator' }
          ]
        }]
        : []
    ),
    // { role: 'windowMenu' }
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { label: 'Hide in tray', role: 'close' }
        ])
      ]
    },
    ...(settings ? [
      {
        label: 'Settings',
        submenu: [
          {
            label: 'Idle behavior',
            submenu: [
              {label: 'Do nothing', type: 'radio', checked: !settings.idleBehavior, click: () => updateSettings({ idleBehavior: 0 }, settings) },
              {label: 'Pause if idle for 5m', type: 'radio', checked: settings.idleBehavior === 5, click: () => updateSettings({ idleBehavior: 5 }, settings) },
              {label: 'Pause if idle for 10m', type: 'radio', checked: settings.idleBehavior === 10, click: () => updateSettings({ idleBehavior: 10 }, settings) },
              {label: 'Pause if idle for 15m', type: 'radio', checked: settings.idleBehavior === 15, click: () => updateSettings({ idleBehavior: 15 }, settings) },
              {type: 'separator'},
              {label: 'Auto discard idle time from timer', type: 'checkbox', enabled: !!settings.idleBehavior, checked: settings.discardIdleTime, click: (el) => updateSettings({ discardIdleTime: el.checked }, settings) },
            ]
          },
          {
            label: 'Use advanced timer controls',
            type: 'checkbox',
            checked: settings.advancedTimerControls, click: (el) => updateSettings({ advancedTimerControls: el.checked }, settings),
          },
          {
            label: 'Use progress slider with 1% steps',
            type: 'checkbox',
            checked: settings.progressWithStep1, click: (el) => updateSettings({ progressWithStep1: el.checked }, settings),
          },
        ]
      },
    ] : []),
    {
      role: 'help',
      submenu: [
        {
          label: 'Report An Issue',
          click: () => electronUtils.openNewGitHubIssue({
            user: 'Spring3',
            repo: 'redshape',
            body: `Please describe the issue as detailed as you can\n\n---\n### Debug Info:\n \`\`\`\n${electronUtils.debugInfo()}\n\`\`\``
          })
        }
      ]
    }
  ]);

  Menu.setApplicationMenu(menu);
}

const initializeMenu = () => {
  generateMenu({});
};

const createAboutWindow = () => {
  const windowConfig = utils.fixIcon({
    width: 480,
    height: 400,
    minWidth: 480,
    minHeight: 400,
    maxWidth: 600,
    maxHeight: 520,
    useContentSize: true,
    titleBarStyle: 'hidden',
    show: false,
    webPreferences: {
      nodeIntegration: true
    },
  });

  aboutWindow = new BrowserWindow(windowConfig);

  aboutWindow.loadURL(
    isDev
      ? url.format({
        protocol: 'http:',
        host: `localhost:${PORT}`,
        pathname: 'about.html',
        slashes: true
      })
      : url.format({
        protocol: 'file:',
        pathname: path.join(__dirname, '../dist/about.html'),
        slashes: true
      })
  );

  aboutWindow.once('closed', () => {
    aboutWindow = null;
  });

  aboutWindow.setMenu(null);
};

const initialize = () => {
  const windowConfig = utils.fixIcon({
    width: 1024,
    height: 768,
    minWidth: 744,
    show: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: true
    }
  });

  const indexPath = isDev
    ? url.format({
      protocol: 'http:',
      host: `localhost:${PORT}`,
      pathname: 'index.html',
      slashes: true
    })
    : url.format({
      protocol: 'file:',
      pathname: path.join(__dirname, '../dist/index.html'),
      slashes: true
    });

  mainWindow = new BrowserWindow(windowConfig);
  mainWindow.loadURL(indexPath);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.once('closed', () => {
    mainWindow = null;
  });

  setupTray({ app, mainWindow, NAME, windowConfig });

  ipcMain.on('notify', (ev, { message, critical, keep }) => {
    const notification = new Notification({
      title: 'System is idle',
      body: message || 'Timer will be paused if system continues idle',
      icon: windowConfig.icon,
      timeoutType: keep ? 'never' : 'default',
      urgency: critical ? 'critical' : 'normal',
      silent: false,
    });
    notification.show();
  });
  ipcMain.on('menu', (ev, {settings}) => {
    generateMenu({ settings });
  });

};

app.once('ready', () => {
  initialize();
  initializeMenu();
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    initialize();
  }
});
