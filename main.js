const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const net = require('net');
const fs = require('fs');
const https = require('https');

// --- APP INFO ---
const APP_NAME = 'Fatal Notifications';
const APP_VERSION = '1.0.0';
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
        tray.setToolTip(`Fatal Notifications - ${isRunning ? 'Running' : 'Stopped'}`);
    }
}

// --- PUSHBULLET ---
function sendPushbulletAlarm(title, message) {
    const pbKey = settings.pb_api_key;
    if (!pbKey) {
        sendLog('❌ No Pushbullet API Key configured!');
        return;
    }

    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    sendLog(`🔔 SENDING [${title}]: ${message.substring(0, 30)}...`);

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
        if (res.statusCode !== 200) {
            sendLog(`❌ Pushbullet error: ${res.statusCode}`);
        }
    });

    req.on('error', (err) => {
        sendLog(`❌ Connection Error: ${err.message}`);
    });

    req.write(postData);
    req.end();
}

// --- TS3 MONITORING ---
function startMonitoring() {
    if (running) return;
    running = true;
    setStatus(true);

    const ts3Key = settings.ts3_api_key;
    const filters = settings.filters || {};

    socket = new net.Socket();
    socket.setTimeout(1000);

    let buffer = '';
    let handlerIds = [];

    socket.connect(DEFAULT_TS3_PORT, DEFAULT_TS3_IP, () => {
        sendLog('Connected to TS3 ClientQuery');
        socket.write(`auth apikey=${ts3Key}\n`);

        setTimeout(() => {
            socket.write('serverconnectionhandlerlist\n');
        }, 500);
    });

    socket.on('data', (data) => {
        buffer += data.toString();

        while (buffer.includes('\n')) {
            const [line, ...rest] = buffer.split('\n');
            buffer = rest.join('\n');

            // Extract handler IDs
            const handlerMatch = line.match(/schandlerid=(\d+)/g);
            if (handlerMatch) {
                const newIds = handlerMatch.map(m => m.split('=')[1]);
                const uniqueIds = [...new Set([...handlerIds, ...newIds])];

                if (uniqueIds.length > handlerIds.length) {
                    handlerIds = uniqueIds;
                    sendLog(`Tabs found: ${handlerIds.join(', ')}`);

                    for (const hid of handlerIds) {
                        socket.write(`clientnotifyregister schandlerid=${hid} event=textchannel\n`);
                        socket.write(`clientnotifyregister schandlerid=${hid} event=textprivate\n`);
                        socket.write(`clientnotifyregister schandlerid=${hid} event=any\n`);
                    }

                    sendLog(`Ready! Filtering messages from '${TARGET_NAME}'...`);
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

                    if (msgLower.includes('hunted')) {
                        if (isDeath) {
                            if (filters.hunted_death !== false) {
                                sendPushbulletAlarm('Hunted Death', cleanMsg);
                            }
                        } else {
                            if (filters.hunted_up !== false) {
                                sendPushbulletAlarm('Hunted Up', cleanMsg);
                            }
                        }
                    } else if (msgLower.includes('friend')) {
                        if (isDeath) {
                            if (filters.friend_death !== false) {
                                sendPushbulletAlarm('Friend Death', cleanMsg);
                            }
                        } else {
                            if (filters.friend_up !== false) {
                                sendPushbulletAlarm('Friend Up', cleanMsg);
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
        sendLog(`Connection Failed: ${err.message}`);
        stopMonitoring();
    });

    socket.on('close', () => {
        if (running) {
            sendLog('Connection closed');
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
    sendLog('Stopped');
}

// --- AUTO-UPDATE ---
function checkForUpdates() {
    return new Promise((resolve) => {
        const options = {
            hostname: 'api.github.com',
            path: `/repos/${GITHUB_REPO}/releases/latest`,
            headers: { 'User-Agent': 'FatalNotifications' }
        };

        https.get(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const release = JSON.parse(data);
                    const latestVersion = (release.tag_name || '').replace(/^v/, '');

                    if (latestVersion && latestVersion !== APP_VERSION) {
                        const exeAsset = (release.assets || []).find(a => a.name.endsWith('.exe'));
                        if (exeAsset) {
                            resolve({
                                available: true,
                                version: latestVersion,
                                download_url: exeAsset.browser_download_url,
                                notes: release.body || ''
                            });
                            return;
                        }
                    }
                    resolve({ available: false });
                } catch {
                    resolve({ available: false });
                }
            });
        }).on('error', () => resolve({ available: false }));
    });
}

function downloadUpdate(url) {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const { shell } = require('electron');

    const tempDir = os.tmpdir();
    const destPath = path.join(tempDir, 'FatalNotifications_Update.exe');
    const file = fs.createWriteStream(destPath);

    https.get(url, (response) => {
        // Handle redirect if needed
        if (response.statusCode === 302 || response.statusCode === 301) {
            downloadUpdate(response.headers.location);
            return;
        }

        const totalBytes = parseInt(response.headers['content-length'], 10);
        let receivedBytes = 0;

        response.pipe(file);

        response.on('data', (chunk) => {
            receivedBytes += chunk.length;
            if (mainWindow) {
                const percentage = (receivedBytes / totalBytes) * 100;
                mainWindow.webContents.send('download-progress', percentage);
            }
        });

        file.on('finish', () => {
            file.close(() => {
                if (mainWindow) {
                    mainWindow.webContents.send('download-complete');
                }
                // Run the installer/executable
                shell.openPath(destPath).then(() => {
                    setTimeout(() => app.quit(), 1000);
                });
            });
        });
    }).on('error', (err) => {
        fs.unlink(destPath, () => { }); // Delete the file async. (But we don't check the result)
        if (mainWindow) {
            mainWindow.webContents.send('download-error', err.message);
        }
    });
}

// --- SYSTEM TRAY ---
function createTray() {
    // Create a simple tray icon (16x16 colored square)
    const icon = nativeImage.createFromDataURL(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAhGVYSWZNTQAqAAAACAAFARIAAwAAAAEAAQAAARoABQAAAAEAAABKARsABQAAAAEAAABSASgAAwAAAAEAAgAAh2kABAAAAAEAAABaAAAAAAAAAEgAAAABAAAASAAAAAEAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAEKADAAQAAAABAAAAEAAAAADHbxzxAAAACXBIWXMAAAsTAAALEwEAmpwYAAACaGlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNi4wLjAiPgogICA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogICAgICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIgogICAgICAgICAgICB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyIKICAgICAgICAgICAgeG1sbnM6ZXhpZj0iaHR0cDovL25zLmFkb2JlLmNvbS9leGlmLzEuMC8iPgogICAgICAgICA8dGlmZjpZUmVzb2x1dGlvbj43MjwvdGlmZjpZUmVzb2x1dGlvbj4KICAgICAgICAgPHRpZmY6UmVzb2x1dGlvblVuaXQ+MjwvdGlmZjpSZXNvbHV0aW9uVW5pdD4KICAgICAgICAgPHRpZmY6WFJlc29sdXRpb24+NzI8L3RpZmY6WFJlc29sdXRpb24+CiAgICAgICAgIDx0aWZmOk9yaWVudGF0aW9uPjE8L3RpZmY6T3JpZW50YXRpb24+CiAgICAgICAgIDxleGlmOlBpeGVsWERpbWVuc2lvbj4xNjwvZXhpZjpQaXhlbFhEaW1lbnNpb24+CiAgICAgICAgIDxleGlmOkNvbG9yU3BhY2U+MTwvZXhpZjpDb2xvclNwYWNlPgogICAgICAgICA8ZXhpZjpQaXhlbFlEaW1lbnNpb24+MTY8L2V4aWY6UGl4ZWxZRGltZW5zaW9uPgogICAgICA8L3JkZjpEZXNjcmlwdGlvbj4KICAgPC9yZGY6UkRGPgo8L3g6eG1wbWV0YT4KFmglJAAAAMFJREFUOBFjZGBg+M+ABzAxEKFhaIoZicjDzEpMIVCZ/yR4ASgFcgELMQbAHAHyEsgF5ACYLTCbYOJwF8AF8AgSYwBMPywkMBqJ0QSxB+gy4DPEBwgNIE0g28B2gxyCIE6MI0C2oHkB7AqQGCHXgPTD0gLYBeSEBMgWkAtAmsDpgBT/gpyGFhLEugBkC0gdNBAMSRGCz/+EHEFICMBcgJYQYYYT4wKQLSA3YBgO8wJROQHNFoIpnpAAQ0sJZJfAzAbxAX1FXpYOEuqFAAAAAElFTkSuQmCC'
    );

    tray = new Tray(icon);
    tray.setToolTip('Fatal Notifications - Stopped');

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        },
        {
            label: 'Start Monitoring',
            click: () => {
                if (!running) {
                    settings = loadSettings();
                    startMonitoring();
                }
            }
        },
        {
            label: 'Stop Monitoring',
            click: () => {
                if (running) {
                    stopMonitoring();
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
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
        width: 720,
        height: 750,
        resizable: true, // Re-enabled resizing
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
ipcMain.handle('download-update', (_, url) => downloadUpdate(url));
ipcMain.handle('start-monitoring', () => { startMonitoring(); });
ipcMain.handle('stop-monitoring', () => { stopMonitoring(); });
ipcMain.handle('minimize-to-tray', () => {
    if (mainWindow) mainWindow.hide();
});
