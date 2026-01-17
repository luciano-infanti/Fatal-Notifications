# Fatal Notifications

A desktop app that monitors TeamSpeak 3 for bot messages and sends push notifications via Pushbullet.

## Features

- 🔔 **Real-time Alerts**: Get notified instantly when BB-Bot sends messages
- 📱 **Pushbullet Integration**: Receive notifications on your phone
- 🎨 **Modern UI**: Discord-inspired dark theme
- 🔄 **Auto-Update**: Automatically checks for and installs updates
- 💾 **Persistent Settings**: Your API keys are saved locally

## Download

Download the latest `.exe` from [Releases](https://github.com/sickn33/fatal-notifications/releases).

## Setup

1. **TS3 API Key**: In TeamSpeak, go to `Tools > Options > Addons > ClientQuery` and copy the API Key
2. **Pushbullet API Key**: Get your Access Token from [pushbullet.com/settings](https://www.pushbullet.com/#settings)
3. Enter both keys in the app and click **Save**
4. Click **Start Monitoring**

## Notification Filters

- **Next Respawn**: Pokes containing "chegou sua vez no respawn"
- **Other Pokes**: All other poke messages
- **Hunted Up/Death**: Messages containing "hunted"
- **Friend Up/Death**: Messages containing "friend"

## Building from Source

```bash
pip install eel requests pyinstaller
pyinstaller --onefile --windowed --add-data "web;web" --name "FatalNotifications" pushbullet.py
```

## License

MIT
