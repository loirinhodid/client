const { contextBridge, ipcRenderer } = require('electron');

// Isso cria "window.electronAPI" dentro da página remota que a janela carrega.
contextBridge.exposeInMainWorld('electronAPI', {
  abrirJogo: () => ipcRenderer.invoke('abrir-jogo'),
  abrirPastaJogo: () => ipcRenderer.invoke('abrir-pasta-jogo'),
  reconfigurarJogo: () => ipcRenderer.invoke('reconfigurar-jogo'),
  abrirConfig: () => ipcRenderer.invoke('abrir-config'),
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('set-auto-launch', enabled),
  getConfig: () => ipcRenderer.invoke('get-config'),
  getInstallPath: () => ipcRenderer.invoke('get-install-path'),
  getConfigPath: () => ipcRenderer.invoke('get-config-path'),
  openInstallFolder: () => ipcRenderer.invoke('open-install-folder'),
  openConfigFolder: () => ipcRenderer.invoke('open-config-folder'),
  disponivel: true
});

// Controles de janela customizada (minimizar/maximizar/fechar)
contextBridge.exposeInMainWorld('janelaAPI', {
  minimizar: () => ipcRenderer.send('janela-minimizar'),
  maximizar: () => ipcRenderer.send('janela-maximizar'),
  fechar: () => ipcRenderer.send('janela-fechar'),
  aoMaximizarMudar: (callback) => ipcRenderer.on('janela-maximizada', (_e, valor) => callback(valor))
});