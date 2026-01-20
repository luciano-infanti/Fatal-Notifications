const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getAppInfo: () => ipcRenderer.invoke('get-app-info'),
    loadSettings: () => ipcRenderer.invoke('load-settings'),
    saveSettings: (data) => ipcRenderer.invoke('save-settings', data),
    checkUpdate: () => ipcRenderer.invoke('check-update'),
    startMonitoring: () => ipcRenderer.invoke('start-monitoring'),
    stopMonitoring: () => ipcRenderer.invoke('stop-monitoring'),
    minimizeToTray: () => ipcRenderer.invoke('minimize-to-tray'),
    downloadUpdate: (url) => ipcRenderer.invoke('download-update', url),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),

    onLog: (callback) => ipcRenderer.on('log', (_, message) => callback(message)),
    onStatus: (callback) => ipcRenderer.on('status', (_, isRunning) => callback(isRunning)),
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (_, percent) => callback(percent)),
    onDownloadComplete: (callback) => ipcRenderer.on('download-complete', () => callback()),
    onDownloadError: (callback) => ipcRenderer.on('download-error', (_, err) => callback(err))
});
