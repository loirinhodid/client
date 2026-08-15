const { app, BrowserWindow, ipcMain, dialog, shell, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');

// URL do app remoto carregado
const URL_DO_APP = 'https://important-nexus-launch-pad.base44.app';

let mainWindow = null;
let settingsWindow = null;
let tray = null;
let isQuitting = false;

function setAutoLaunch(enabled) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
    args: []
  });
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 460,
    height: 340,
    resizable: false,
    minimizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    title: 'Rover Client — Configurações locais',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function createMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'Arquivo',
      submenu: [
        {
          label: 'Parademais configurações locais',
          accelerator: 'Ctrl+,',
          click: () => createSettingsWindow()
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'n.ico');
  let icon = nativeImage.createFromPath(iconPath);
  // Fallback se o .ico for inválido/ausente: tenta PNG e redimensiona
  if (icon.isEmpty()) {
    const fallbackPath = path.join(__dirname, 'assets', 'logo.png');
    log.warn('Ícone de bandeja inválido em', iconPath, '-- tentando fallback', fallbackPath);
    icon = nativeImage.createFromPath(fallbackPath);
    if (!icon.isEmpty()) icon = icon.resize({ width: 16, height: 16 });
  }
  tray = new Tray(icon);
  tray.setToolTip('Rover Client');
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir Rover Client',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    {
      label: 'Configurações do Rover Client',
      click: () => createSettingsWindow()
    },
    {
      label: 'Minimizar para a bandeja ao fechar',
      type: 'checkbox',
      checked: lerConfig().minimizeToTray === true,
      click: (menuItem) => {
        const config = lerConfig();
        config.minimizeToTray = menuItem.checked;
        salvarConfig(config);
      }
    },
    {
      label: 'Abrir pasta da instalação',
      click: () => shell.openPath(path.dirname(process.execPath))
    },
    {
      label: 'Abrir pasta de configurações',
      click: () => shell.openPath(path.dirname(configPath))
    },
    { type: 'separator' },
    {
      label: 'Sair',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
}

const configPath = path.join(app.getPath('userData'), 'config.json');

function lerConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    return {};
  }
}

function salvarConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function createWindow() {
  if (mainWindow) {
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 940,
    minHeight: 620,
    show: false,
    center: true,
    frame: true,
    roundedCorners: false,
    titleBarStyle: 'default',
    title: 'Rover Client',
    backgroundColor: '#0f1115',
    minimizable: true,
    maximizable: true,
    resizable: true,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'n.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // informa o estado inicial de maximização para a UI renderizada
    if (mainWindow.webContents) mainWindow.webContents.send('janela-maximizada', mainWindow.isMaximized());
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(URL_DO_APP);

  mainWindow.on('close', (event) => {
    if (!isQuitting && tray && lerConfig().minimizeToTray === true) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // notifica mudanças de estado de maximização para a UI
  mainWindow.on('maximize', () => {
    if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('janela-maximizada', true);
  });
  mainWindow.on('unmaximize', () => {
    if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('janela-maximizada', false);
  });
}

function setupAutoUpdate() {
  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = 'info';
  autoUpdater.autoDownload = true;

  autoUpdater.on('checking-for-update', () => log.info('Procurando atualizações...'));
  autoUpdater.on('update-available', (info) => log.info('Atualização disponível:', info));
  autoUpdater.on('update-not-available', (info) => log.info('Nenhuma atualização disponível:', info));
  autoUpdater.on('error', (err) => log.error('Erro no auto-update:', err));
  autoUpdater.on('download-progress', (progress) => log.info(`Download ${Math.round(progress.percent)}% concluído`));
  autoUpdater.on('update-downloaded', () => {
    log.info('Atualização baixada. Reiniciando para instalar...');
    autoUpdater.quitAndInstall();
  });
}

// Agendador de checagem de atualizações com backoff controlado.
function startAutoUpdateScheduler() {
  const initialInterval = 5 * 60 * 1000; // 5 minutos
  const maxInterval = 4 * 60 * 60 * 1000; // 4 horas
  let currentInterval = initialInterval;
  let timer = null;

  const scheduleNext = (reset = false) => {
    if (timer) clearTimeout(timer);
    if (reset) currentInterval = initialInterval;
    timer = setTimeout(async () => {
      try {
        log.info('Verificando atualizações agendadas...');
        await autoUpdater.checkForUpdates();
        // no error: consider the check successful and reset to initial interval
        scheduleNext(true);
      } catch (err) {
        log.warn('Erro ao checar atualizações agendadas:', err);
        // on error increase interval with cap
        currentInterval = Math.min(currentInterval * 2, maxInterval);
        scheduleNext(false);
      }
    }, currentInterval);
  };

  // Start after a short delay so app can finish startup tasks
  scheduleNext(true);
}

app.whenReady().then(() => {
  setupAutoUpdate();
  createMenu();
  createTray();

  const config = lerConfig();
  if (config.autoLaunch) {
    setAutoLaunch(true);
  }

  createWindow();
  // faz uma verificação imediata e inicia o agendador com backoff
  autoUpdater.checkForUpdatesAndNotify();
  startAutoUpdateScheduler();
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Abre o jogo. Se ainda não sabe onde ele está, pede pra você escolher
// o .exe uma vez e guarda o caminho pras próximas vezes.
ipcMain.handle('abrir-jogo', async () => {
  const config = lerConfig();
  let caminhoJogo = config.caminhoJogo;

  if (!caminhoJogo || !fs.existsSync(caminhoJogo)) {
    const resultado = await dialog.showOpenDialog({
      title: 'Selecione o executável do jogo',
      properties: ['openFile'],
      filters: [{ name: 'Executáveis', extensions: ['exe'] }]
    });

    if (resultado.canceled || resultado.filePaths.length === 0) {
      return { sucesso: false, mensagem: 'Nenhum arquivo selecionado.' };
    }

    caminhoJogo = resultado.filePaths[0];
    config.caminhoJogo = caminhoJogo;
    salvarConfig(config);
  }

  try {
    const erro = await shell.openPath(caminhoJogo);
    if (erro) return { sucesso: false, mensagem: erro };
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: erro.message };
  }
});

// Abre a pasta do jogo (a pasta onde está o .exe configurado)
ipcMain.handle('abrir-pasta-jogo', async () => {
  const config = lerConfig();
  const caminhoJogo = config.caminhoJogo;

  if (!caminhoJogo) {
    return { sucesso: false, mensagem: 'Nenhum jogo configurado ainda. Clique em "abrir jogo" uma vez primeiro.' };
  }

  const pasta = path.dirname(caminhoJogo);
  const erro = await shell.openPath(pasta);
  if (erro) return { sucesso: false, mensagem: erro };
  return { sucesso: true };
});

// Esquece o caminho salvo, pra você poder escolher outro jogo/pasta depois
ipcMain.handle('reconfigurar-jogo', async () => {
  const config = lerConfig();
  delete config.caminhoJogo;
  salvarConfig(config);
  return { sucesso: true };
});

ipcMain.handle('abrir-config', () => {
  createSettingsWindow();
  return { sucesso: true };
});

ipcMain.handle('get-auto-launch', () => {
  const settings = app.getLoginItemSettings({ path: process.execPath });
  return settings.openAtLogin;
});

ipcMain.handle('set-auto-launch', (_event, enabled) => {
  setAutoLaunch(Boolean(enabled));
  const config = lerConfig();
  config.autoLaunch = Boolean(enabled);
  salvarConfig(config);
  return { sucesso: true };
});

ipcMain.handle('get-config', () => {
  return lerConfig();
});

ipcMain.handle('get-install-path', () => {
  return process.execPath;
});

ipcMain.handle('get-config-path', () => {
  return configPath;
});

ipcMain.handle('open-install-folder', () => {
  shell.openPath(path.dirname(process.execPath));
  return { sucesso: true };
});

ipcMain.handle('open-config-folder', () => {
  shell.openPath(path.dirname(configPath));
  return { sucesso: true };
});

// Handlers para controles de janela expostos no `preload.js` (window.janelaAPI)
ipcMain.on('janela-minimizar', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('janela-maximizar', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
  if (mainWindow.webContents) mainWindow.webContents.send('janela-maximizada', mainWindow.isMaximized());
});

ipcMain.on('janela-fechar', () => {
  if (mainWindow) mainWindow.close();
});
