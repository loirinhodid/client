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
const projectRoot = path.join(__dirname, '..', '..');
const preloadPath = path.join(projectRoot, 'src', 'preload', 'preload.js');
const rendererPath = path.join(projectRoot, 'src', 'renderer');
const iconPath = path.join(projectRoot, 'public', 'assets', 'n.ico');

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
    resizable: false,
    minimizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    title: 'Rover Client — Configurações locais',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  settingsWindow.loadFile(path.join(rendererPath, 'settings.html'));

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
  let icon = nativeImage.createFromPath(iconPath);
  // Fallback se o .ico for inválido/ausente: tenta PNG e redimensiona
  if (icon.isEmpty()) {
    const fallbackPath = path.join(projectRoot, 'public', 'assets', 'logo.png');
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

function pastaSonsDoJogo(nomeJogo) {
  const base = path.join(app.getPath('userData'), 'sons-customizados', nomeJogo);
  fs.mkdirSync(base, { recursive: true });
  return base;
}

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
  const config = lerConfig();
  const iniciarMinimizado = config.startMinimized === true;

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
    icon: iconPath,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once('ready-to-show', () => {
    if (iniciarMinimizado) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
    // informa o estado inicial de maximização para a UI renderizada
    if (mainWindow.webContents) mainWindow.webContents.send('janela-maximizada', mainWindow.isMaximized());
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(URL_DO_APP);

  // Permite que o Chromium reduza o trabalho do app remoto fora do primeiro plano.
  // Ao restaurar, o throttling é desativado para a UI voltar imediatamente.
  const atualizarDesempenhoDaJanela = (emSegundoPlano) => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.setBackgroundThrottling(emSegundoPlano);
    }
  };
    setAutoLaunch(true);
  mainWindow.on('minimize', () => atualizarDesempenhoDaJanela(true));
  mainWindow.on('hide', () => atualizarDesempenhoDaJanela(true));
  mainWindow.on('restore', () => atualizarDesempenhoDaJanela(false));
  mainWindow.on('show', () => atualizarDesempenhoDaJanela(false));
  mainWindow.on('blur', () => atualizarDesempenhoDaJanela(true));
  mainWindow.on('focus', () => atualizarDesempenhoDaJanela(false));

  // After the page finishes loading, attempt to remove the edit badge if present
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      (function () {
        const closeBtn = document.getElementById('badge-close');
        if (closeBtn) {
          closeBtn.click();
        } else {
          const badge = document.getElementById('base44-edit-badge');
          if (badge) badge.style.display = 'none';
        }
      })();
    `).catch(err => console.error('Erro ao remover badge:', err));
  });

  // Fechar respeita a opção "Minimizar para a bandeja ao fechar":
  //   opção ON  -> esconde na bandeja (não fecha)
  //   opção OFF -> fecha normalmente (app encerra)
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
    salvarConfig(config);
  }

  try {
    const erro = await shell.openPath(caminhoJogo);
    if (erro) return { sucesso: false, mensagem: erro };
    if (mainWindow && !mainWindow.isMinimized()) mainWindow.minimize();
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

ipcMain.handle('sons:salvar', async (_event, { nomeJogo, arquivoBuffer, extensao }) => {
  const pasta = pastaSonsDoJogo(nomeJogo);
  const nomeArquivo = `som-${Date.now()}.${extensao}`;
  const caminhoCompleto = path.join(pasta, nomeArquivo);

  fs.writeFileSync(caminhoCompleto, Buffer.from(arquivoBuffer));

  return { ok: true, nomeArquivo, caminho: caminhoCompleto };
});

ipcMain.handle('sons:listar', async (_event, { nomeJogo }) => {
  const pasta = pastaSonsDoJogo(nomeJogo);
  const arquivos = fs.readdirSync(pasta);
  return arquivos.map((nome) => ({
    nome,
    caminho: path.join(pasta, nome),
  }));
});

ipcMain.handle('sons:remover', async (_event, { nomeJogo, nomeArquivo }) => {
  const pasta = pastaSonsDoJogo(nomeJogo);
  const caminho = path.join(pasta, nomeArquivo);
  if (fs.existsSync(caminho)) {
    fs.unlinkSync(caminho);
    return { ok: true };
  }
  return { ok: false, motivo: 'arquivo não encontrado' };
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

ipcMain.handle('get-start-minimized', () => {
  return lerConfig().startMinimized === true;
});

ipcMain.handle('set-start-minimized', (_event, enabled) => {
  const config = lerConfig();
  config.startMinimized = Boolean(enabled);
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

// Esconde a janela direto na bandeja (botão "Ocultar na Bandeja" do menu).
ipcMain.on('janela-esconder-bandeja', () => {
  if (mainWindow) mainWindow.hide();
});

// Encerra o app de fato (botão "Sair do Launcher").
ipcMain.on('janela-sair', () => {
  isQuitting = true;
  app.quit();
});
