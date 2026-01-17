const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getAppInfo: () => ipcRenderer.invoke('get-app-info'),
    loadSettings: () => ipcRenderer.invoke('load-settings'),
    saveSettings: (data) => ipcRenderer.invoke('save-settings', data),
    checkUpdate: () => ipcRenderer.invoke('check-update'),
    startMonitoring: () => ipcRenderer.invoke('start-monitoring'),
    stopMonitoring: () => ipcRenderer.invoke('stop-monitoring'),
    minimizeToTray: () => ipcRenderer.invoke('minimize-to-tray'),

    onLog: (callback) => ipcRenderer.on('log', (_, message) => callback(message)),
    onStatus: (callback) => ipcRenderer.on('status', (_, isRunning) => callback(isRunning))
});
