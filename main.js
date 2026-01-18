const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const net = require('net');
const fs = require('fs');
const https = require('https');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;
autoUpdater.autoDownload = false; // We will trigger download manually
autoUpdater.autoInstallOnAppQuit = true;


// --- APP INFO ---
const APP_NAME = 'Fatal Notifications';
const APP_VERSION = app.getVersion();
const GITHUB_REPO = 'luciano-infanti/Fatal-Notifications';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

// --- CONSTANTS ---
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
const DEFAULT_TS3_IP = '127.0.0.1';
const DEFAULT_TS3_PORT = 25639;
const TARGET_NAME = 'BB-Bot';

// --- GLOBAL STATE ---
let mainWindow = null;
let tray = null;
let socket = null;
let running = false;
let settings = {};

// --- UTILITY FUNCTIONS ---
function loadSettings() {
    const defaults = {
        ts3_api_key: '',
        pb_api_key: '',
        filters: {
            next: true,
            poke: true,
            hunted_up: true,
            friend_up: true,
            hunted_death: true,
            friend_death: true
        }
    };

    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const loaded = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
            return { ...defaults, ...loaded, filters: { ...defaults.filters, ...loaded.filters } };
        }
    } catch (err) {
        console.error('Error loading settings:', err);
    }
    return defaults;
}

function saveSettings(data) {
    try {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
        settings = data;
        return true;
    } catch (err) {
        console.error('Error saving settings:', err);
        return false;
    }
}

function unescapeTs3Chars(value) {
    const mapping = {
        '\\\\': '\\',
        '\\/': '/',
        '\\s': ' ',
        '\\p': '|',
        '\\n': '\n',
        '\\r': '\r',
        '\\t': '\t'
    };
    let ret = value;
    for (const [k, v] of Object.entries(mapping)) {
        ret = ret.split(k).join(v);
    }
    return ret;
}

function cleanTs3Message(text) {
    if (!text) return { success: false, message: '' };
    let temp = text.replace(/\[b\]/g, '').replace(/\[\/b\]/g, '');
    temp = temp.replace(/\[.*?\]/g, '');
    temp = temp.replace(/\s+/g, ' ').trim();
    if (!temp) return { success: false, message: text };
    return { success: true, message: temp };
}

function parseTs3Response(line) {
    if (!line) return {};
    const data = {};
    const parts = line.trim().split(' ');
    for (const part of parts) {
        if (part.includes('=')) {
            const [key, ...vals] = part.split('=');
            data[key] = unescapeTs3Chars(vals.join('='));
        }
    }
    return data;
}

function sendLog(message) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('log', message);
    }
}

function setStatus(isRunning) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('status', isRunning);
    }
    // Update tray icon tooltip
    if (tray) {
        tray.setToolTip(`Fatal Notifications - ${isRunning ? 'Rodando' : 'Pausado'}`);
    }
}

// --- PUSHBULLET ---
// --- PUSHBULLET ---
function sendPushbulletAlarm(title, message) {
    const pbKey = settings.pb_api_key;
    if (!pbKey) {
        sendLog('❌ Erro: Chave API do Pushbullet não configurada! Verifique as configurações.');
        return;
    }

    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    // User requested cleaner logs: No "🔔 ENVIANDO", no truncation, no bell in text.
    // Format: "[Title]: Message"
    // Split combined messages (e.g., "Player1 upou > 400, Player2 upou > 500") into individual log entries
    if (message.includes(', ') && (message.includes('upou') || message.includes('died') || message.includes('morreu'))) {
        const entries = message.split(', ');
        for (const entry of entries) {
            if (entry.trim()) {
                sendLog(`[${title}]: ${entry.trim()}`);
            }
        }
    } else {
        sendLog(`[${title}]: ${message}`);
    }

    const postData = JSON.stringify({
        type: 'note',
        title: `${title} (${timestamp})`,
        body: message
    });

    const options = {
        hostname: 'api.pushbullet.com',
        port: 443,
        path: '/v2/pushes',
        method: 'POST',
        headers: {
            'Access-Token': pbKey,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = https.request(options, (res) => {
        if (res.statusCode === 200) {
            // Success, quiet or verify? we can assume success.
        } else if (res.statusCode === 401 || res.statusCode === 403) {
            sendLog(`❌ Erro Pushbullet (${res.statusCode}): Chave API inválida ou expirada.`);
        } else if (res.statusCode === 400) {
            sendLog(`❌ Erro Pushbullet (400): Requisição inválida.`);
        } else {
            sendLog(`❌ Erro Pushbullet: Falha no envio (Código: ${res.statusCode}).`);
        }
    });

    req.on('error', (err) => {
        sendLog(`❌ Erro de Conexão Pushbullet: ${err.message}`);
    });

    req.write(postData);
    req.end();
}

// --- TS3 MONITORING ---
function startMonitoring() {
    if (running) return;

    // 1. Validation Pre-Check
    const ts3Key = settings.ts3_api_key;
    const pbKey = settings.pb_api_key;

    if (!ts3Key) {
        sendLog('❌ Erro Crítico: Chave API do Teamspeak não informada! Configure-a nas opções.');
        setStatus(false);
        return;
    }
    if (!pbKey) {
        sendLog('❌ Erro Crítico: Chave API do Pushbullet não informada! Configure-a nas opções.');
        setStatus(false);
        return;
    }

    running = true;
    setStatus(true);

    const filters = settings.filters || {};

    socket = new net.Socket();
    socket.setTimeout(5000); // 5s timeout for initial connection

    let buffer = '';
    let handlerIds = [];

    // Attempt connection
    socket.connect(DEFAULT_TS3_PORT, DEFAULT_TS3_IP, () => {
        sendLog('✅ Conexão TCP estabelecida com Teamspeak.');
        sendLog('🔐 Tentando autenticação...');
        socket.write(`auth apikey=${ts3Key}\n`);
    });

    socket.on('data', (data) => {
        buffer += data.toString();

        while (buffer.includes('\n')) {
            const [line, ...rest] = buffer.split('\n');
            buffer = rest.join('\n');
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            // --- Error / Status Handling ---
            if (trimmedLine.startsWith('error')) {
                const dataMap = parseTs3Response(trimmedLine);
                const id = parseInt(dataMap.id, 10);
                const msg = dataMap.msg;

                if (id !== 0) {
                    if (id === 520) { // invalid login/pwd (or api key)
                        sendLog(`❌ Erro de Autenticação: Chave API Inválida! (ID: 520). Verifique sua chave.`);
                    } else if (id === 2568) { // insufficient permissions (sometimes happens)
                        sendLog(`❌ Erro de Permissão (ID: 2568): ${msg}`);
                    } else {
                        sendLog(`❌ Erro TS3: ${msg} (ID: ${id})`);
                    }
                    stopMonitoring(); // Critical failure, stop.
                    return;
                }

                // If id==0, it's a success message for the previous command.
                // We can use this to chain logic if strictly needed, or stick to timeouts/flow.
                // For 'auth', a successful auth returns error id=0.
            }

            // --- Logic Flow ---
            // After auth (we assume it worked if no error came immediately, but 'error id=0' confirms it),
            // we request the handler list.
            // A simple heuristic: if we just authed, we can schedule the next check.
            // Ideally we wait for 'error id=0' after auth to proceed.
            // Let's rely on the previous timeout approach vs explicit parsing for simplicity, 
            // OR strictly parse 'error id=0'. Let's stick to the robust 'error id=...'.

            // Check success of AUTH
            if (trimmedLine.includes('error id=0') && handlerIds.length === 0) {
                // Auth likely successful, or some other command. 
                // We'll just ensure we request list if we haven't already.
                // To avoid spam, let's just trigger the list request slightly after connect.
                // Actually, let's trigger it NOW.
                setTimeout(() => {
                    if (running) socket.write('serverconnectionhandlerlist\n');
                }, 200);
            }


            // Extract handler IDs
            const handlerMatch = line.match(/schandlerid=(\d+)/g);
            if (handlerMatch) {
                const newIds = handlerMatch.map(m => m.split('=')[1]);
                const uniqueIds = [...new Set([...handlerIds, ...newIds])];

                if (uniqueIds.length > handlerIds.length) {
                    handlerIds = uniqueIds;
                    sendLog(`✅ Abas encontradas: ${handlerIds.join(', ')}`);

                    for (const hid of handlerIds) {
                        socket.write(`clientnotifyregister schandlerid=${hid} event=textchannel\n`);
                        socket.write(`clientnotifyregister schandlerid=${hid} event=textprivate\n`);
                        socket.write(`clientnotifyregister schandlerid=${hid} event=any\n`);
                    }

                    sendLog(`🚀 Monitoramento Iniciado em '${TARGET_NAME}'!`);
                }
            }

            // Process messages
            const dataMap = parseTs3Response(line);
            const invoker = dataMap.invokername || '';

            if (invoker.toLowerCase().includes(TARGET_NAME.toLowerCase())) {
                const rawMsg = dataMap.msg || '';
                const { message: cleanMsg } = cleanTs3Message(rawMsg);
                const msgLower = cleanMsg.toLowerCase();

                // Handle Pokes
                if (line.includes('notifyclientpoke')) {
                    if (msgLower.includes('chegou sua vez no respawn')) {
                        if (filters.next !== false) {
                            sendPushbulletAlarm('Next Respawn', cleanMsg);
                        }
                    } else {
                        if (filters.poke !== false) {
                            sendPushbulletAlarm('Poke', cleanMsg);
                        }
                    }
                }
                // Handle Text Messages
                else if (line.includes('notifytextmessage')) {
                    const isDeath = ['died', 'death', 'morreu', 'killed'].some(x => msgLower.includes(x));

                    // Strip redundant prefixes requested by user
                    // Regex covers: "FRIEND UP:", "FRIEND DEATH:", "HUNTED UP:", "HUNTED DEATH:" (case insensitive)
                    // Added "DOWN" variants just in case.
                    const finalMsg = cleanMsg.replace(/^(FRIEND UP|FRIEND DEATH|FRIEND DOWN|HUNTED UP|HUNTED DEATH|HUNTED DOWN):\s*/i, '');

                    if (msgLower.includes('hunted')) {
                        if (isDeath) {
                            if (filters.hunted_death !== false) {
                                sendPushbulletAlarm('Hunted Death', finalMsg);
                            }
                        } else {
                            if (filters.hunted_up !== false) {
                                sendPushbulletAlarm('Hunted Up', finalMsg);
                            }
                        }
                    } else if (msgLower.includes('friend')) {
                        if (isDeath) {
                            if (filters.friend_death !== false) {
                                sendPushbulletAlarm('Friend Death', finalMsg);
                            }
                        } else {
                            if (filters.friend_up !== false) {
                                sendPushbulletAlarm('Friend Up', finalMsg);
                            }
                        }
                    }
                }
            }
        }
    });

    socket.on('timeout', () => {
        // Send keepalive
        if (socket && running) {
            socket.write('\n');
        }
    });

    socket.on('error', (err) => {
        if (err.code === 'ECONNREFUSED') {
            sendLog('❌ Erro Crítico: Não foi possível conectar ao Teamspeak (127.0.0.1:25639).');
            sendLog('👉 Verifique se o Cliente TS3 está ABERTO e o plugin ClientQuery ativado.');
        } else {
            sendLog(`❌ Erro de Conexão TS3: ${err.message}`); // General error
        }
        stopMonitoring();
    });

    socket.on('close', () => {
        if (running) {
            sendLog('⚠️ A conexão com o Teamspeak foi encerrada.');
            stopMonitoring();
        }
    });
}

function stopMonitoring() {
    running = false;
    if (socket) {
        socket.destroy();
        socket = null;
    }
    setStatus(false);
    sendLog('⏹️ Monitoramento Pausado.');
}

// --- AUTO-UPDATE ---
// --- AUTO-UPDATE ---
function checkForUpdates() {
    return new Promise((resolve) => {
        // Use electron-updater to check
        autoUpdater.checkForUpdates()
            .then((result) => {
                // result is UpdateCheckResult | null
                if (result && result.updateInfo) {
                    const info = result.updateInfo;
                    // Check if update is actually available (version > current)
                    // electron-updater handles version comparison, so if we got here via checkForUpdates and it emits update-available, it's good.
                    // But here we are calling it explicitly.

                    // Actually, autoUpdater.checkForUpdates() returns a promise that resolves with the result.
                    // We need to listen to events or inspect the result.

                    // Let's rely on the result object
                    const isAvailable = info.version !== APP_VERSION; // simplified check, autoUpdater is smarter but this suffices for the UI flag

                    if (isAvailable) {
                        resolve({
                            available: true,
                            version: info.version,
                            download_url: '', // autoUpdater handles this
                            notes: (typeof info.releaseNotes === 'string' ? info.releaseNotes : '') || info.body || ''
                        });
                        return;
                    }
                }
                resolve({ available: false });
            })
            .catch(err => {
                log.error('Error checking for updates:', err);
                resolve({ available: false });
            });
    });
}

// Setup event listeners for autoUpdater to forward to renderer
autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow) {
        // progressObj: { bytesPerSecond, percent, total, transferred }
        mainWindow.webContents.send('download-progress', progressObj.percent);
    }
});

autoUpdater.on('update-downloaded', () => {
    if (mainWindow) {
        mainWindow.webContents.send('download-complete');
    }
    // Automatically quit and install after a small delay or user action?
    // User logic had: open destPath then quit.
    // autoUpdater.quitAndInstall() does both.

    // We'll wait for user triggering, but here we just notify completion.
    // Actually, usually we ask user to restart.
    // For now, let's keep the existing flow: existing flow runs installer immediately?
    // The previous code did: shell.openPath(destPath).then(() => setTimeout(() => app.quit(), 1000));

    // We will simulate this:
    setTimeout(() => {
        autoUpdater.quitAndInstall();
    }, 1000);
});

autoUpdater.on('error', (err) => {
    if (mainWindow) {
        mainWindow.webContents.send('download-error', err.message);
    }
});


// --- SYSTEM TRAY ---
function createTray() {
    // Create a simple tray icon (16x16 colored square)
    const icon = nativeImage.createFromDataURL(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAhGVYSWZNTQAqAAAACAAFARIAAwAAAAEAAQAAARoABQAAAAEAAABKARsABQAAAAEAAABSASgAAwAAAAEAAgAAh2kABAAAAAEAAABaAAAAAAAAAEgAAAABAAAASAAAAAEAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAEKADAAQAAAABAAAAEAAAAADHbxzxAAAACXBIWXMAAAsTAAALEwEAmpwYAAACaGlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNi4wLjAiPgogICA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogICAgICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIgogICAgICAgICAgICB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyIKICAgICAgICAgICAgeG1sbnM6ZXhpZj0iaHR0cDovL25zLmFkb2JlLmNvbS9leGlmLzEuMC8iPgogICAgICAgICA8dGlmZjpZUmVzb2x1dGlvbj43MjwvdGlmZjpZUmVzb2x1dGlvbj4KICAgICAgICAgPHRpZmY6UmVzb2x1dGlvblVuaXQ+MjwvdGlmZjpSZXNvbHV0aW9uVW5pdD4KICAgICAgICAgPHRpZmY6WFJlc29sdXRpb24+NzI8L3RpZmY6WFJlc29sdXRpb24+CiAgICAgICAgIDx0aWZmOk9yaWVudGF0aW9uPjE8L3RpZmY6T3JpZW50YXRpb24+CiAgICAgICAgIDxleGlmOlBpeGVsWERpbWVuc2lvbj4xNjwvZXhpZjpQaXhlbFhEaW1lbnNpb24+CiAgICAgICAgIDxleGlmOkNvbG9yU3BhY2U+MTwvZXhpZjpDb2xvclNwYWNlPgogICAgICAgICA8ZXhpZjpQaXhlbFlEaW1lbnNpb24+MTY8L2V4aWY6UGl4ZWxZRGltZW5zaW9uPgogICAgICA8L3JkZjpEZXNjcmlwdGlvbj4KICAgPC9yZGY6UkRGPgo8L3g6eG1wbWV0YT4KFmglJAAAAMFJREFUOBFjZGBg+M+ABzAxEKFhaIoZicjDzEpMIVCZ/yR4ASgFcgELMQbAHAHyEsgF5ACYLTCbYOJwF8AF8AgSYwBMPywkMBqJ0QSxB+gy4DPEBwgNIE0g28B2gxyCIE6MI0C2oHkB7AqQGCHXgPTD0gLYBeSEBMgWkAtAmsDpgBT/gpyGFhLEugBkC0gdNBAMSRGCz/+EHEFICMBcgJYQYYYT4wKQLSA3YBgO8wJROQHNFoIpnpAAQ0sJZJfAzAbxAX1FXpYOEuqFAAAAAElFTkSuQmCC'
    );

    tray = new Tray(icon);
    tray.setToolTip('Fatal Notifications - Pausado');

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Mostrar',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        },
        {
            label: 'Iniciar Monitoramento',
            click: () => {
                if (!running) {
                    settings = loadSettings();
                    startMonitoring();
                }
            }
        },
        {
            label: 'Parar Monitoramento',
            click: () => {
                if (running) {
                    stopMonitoring();
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Sair',
            click: () => {
                stopMonitoring();
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);

    // Double-click to show window
    tray.on('double-click', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

// --- ELECTRON APP ---
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1100,
        height: 750,
        resizable: false, // Fixed window size
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        icon: path.join(__dirname, 'icon.ico'),
        backgroundColor: '#1e1f22'
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
    mainWindow.setMenuBarVisibility(false);

    // Minimize to tray instead of closing
    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    // Load settings on startup
    settings = loadSettings();
}

app.whenReady().then(() => {
    createWindow();
    createTray();
});

// Handle quit properly
app.on('before-quit', () => {
    app.isQuitting = true;
});

app.on('window-all-closed', () => {
    // Don't quit on window close (stays in tray)
});

// --- IPC HANDLERS ---
ipcMain.handle('get-app-info', () => ({ name: APP_NAME, version: APP_VERSION }));
ipcMain.handle('load-settings', () => loadSettings());
ipcMain.handle('save-settings', (_, data) => saveSettings(data));
ipcMain.handle('check-update', () => checkForUpdates());
ipcMain.handle('download-update', () => autoUpdater.downloadUpdate());
ipcMain.handle('start-monitoring', () => { startMonitoring(); });
ipcMain.handle('stop-monitoring', () => { stopMonitoring(); });
ipcMain.handle('minimize-to-tray', () => {
    if (mainWindow) mainWindow.hide();
});
ipcMain.handle('open-external', (_, url) => {
    return shell.openExternal(url);
});