import eel
import socket
import threading
import requests
import datetime
import time
import re
import json
import os
import sys
import subprocess

# --- APP INFO ---
APP_NAME = "Fatal Notifications"
APP_VERSION = "1.0.0"
GITHUB_REPO = "sickn33/fatal-notifications"  # Change this to your actual GitHub username/repo
GITHUB_API_URL = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"

# --- CONSTANTS ---
SETTINGS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "settings.json")
DEFAULT_TS3_IP = "127.0.0.1"
DEFAULT_TS3_PORT = 25639
TARGET_NAME = "BB-Bot"
DEBUG_RAW = False

# Initialize Eel
eel.init('web')

# --- GLOBAL STATE ---
running = False
settings = {}

# --- AUTO-UPDATE FUNCTIONS ---
def check_for_updates():
    """Check GitHub for newer version."""
    try:
        response = requests.get(GITHUB_API_URL, timeout=5)
        if response.status_code == 200:
            data = response.json()
            latest_version = data.get("tag_name", "").lstrip("v")
            if latest_version and latest_version != APP_VERSION:
                # Find the .exe asset
                for asset in data.get("assets", []):
                    if asset["name"].endswith(".exe"):
                        return {
                            "available": True,
                            "version": latest_version,
                            "download_url": asset["browser_download_url"],
                            "notes": data.get("body", "")
                        }
        return {"available": False}
    except:
        return {"available": False}

def download_and_install_update(download_url):
    """Download new version and replace current exe."""
    try:
        # Get current exe path
        if getattr(sys, 'frozen', False):
            current_exe = sys.executable
        else:
            return False, "Not running as exe"
        
        # Download to temp location
        temp_path = current_exe + ".new"
        
        response = requests.get(download_url, stream=True, timeout=60)
        if response.status_code == 200:
            with open(temp_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            # Create batch script to replace exe after this process exits
            batch_path = current_exe + ".update.bat"
            with open(batch_path, 'w') as f:
                f.write(f'''@echo off
timeout /t 2 /nobreak > nul
move /y "{temp_path}" "{current_exe}"
start "" "{current_exe}"
del "%~f0"
''')
            
            # Run the batch script and exit
            subprocess.Popen(['cmd', '/c', batch_path], 
                           creationflags=subprocess.CREATE_NO_WINDOW)
            return True, "Update downloaded. Restarting..."
        return False, "Download failed"
    except Exception as e:
        return False, str(e)

# --- UTILITY FUNCTIONS ---
def _load_settings():
    """Load settings from JSON file."""
    defaults = {
        "ts3_api_key": "",
        "pb_api_key": "",
        "filters": {
            "next": True,
            "poke": True,
            "hunted_up": True,
            "friend_up": True,
            "hunted_death": True,
            "friend_death": True
        }
    }
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r") as f:
                loaded = json.load(f)
                for key in defaults:
                    if key not in loaded:
                        loaded[key] = defaults[key]
                return loaded
        except:
            pass
    return defaults

def _save_settings(data):
    """Save settings to JSON file."""
    try:
        with open(SETTINGS_FILE, "w") as f:
            json.dump(data, f, indent=2)
        return True
    except:
        return False

def unescape_ts3_chars(value):
    mapping = {
        r"\\": "\\", r"\/": "/", r"\s": " ", r"\p": "|",
        r"\a": "\a", r"\b": "\b", r"\f": "\f",
        r"\n": "\n", r"\r": "\r", r"\t": "\t", r"\v": "\v"
    }
    ret = value
    for k, v in mapping.items():
        ret = ret.replace(k, v)
    return ret

def clean_ts3_message(text):
    try:
        if not text: return False, ""
        temp = text.replace('[b]', '').replace('[/b]', '')
        temp = re.sub(r'\[.*?\]', '', temp)
        temp = re.sub(r'\s+', ' ', temp).strip()
        if not temp: return False, text
        return True, temp
    except:
        return False, text

def parse_ts3_response(line):
    if not line: return {}
    parts = line.strip().split(' ')
    data = {}
    for part in parts:
        if "=" in part:
            try:
                key, val = part.split('=', 1)
                data[key] = unescape_ts3_chars(val)
            except ValueError:
                continue
    return data

# --- EEL EXPOSED FUNCTIONS ---
@eel.expose
def get_app_info():
    """Return app name and version."""
    return {"name": APP_NAME, "version": APP_VERSION}

@eel.expose
def check_update():
    """Check for updates."""
    return check_for_updates()

@eel.expose
def do_update(download_url):
    """Download and install update."""
    success, message = download_and_install_update(download_url)
    if success:
        # Exit the app - the batch script will restart it
        os._exit(0)
    return {"success": success, "message": message}

@eel.expose
def load_settings():
    """Load settings and return to JS."""
    global settings
    settings = _load_settings()
    return settings

@eel.expose
def save_settings(data):
    """Save settings from JS."""
    global settings
    settings = data
    return _save_settings(data)

@eel.expose
def start_monitoring():
    """Start the monitoring thread."""
    global running
    if not running:
        running = True
        thread = threading.Thread(target=monitor_loop, daemon=True)
        thread.start()

@eel.expose
def stop_monitoring():
    """Stop the monitoring thread."""
    global running
    running = False
    eel.addLog("Stopping...")

def send_pushbullet_alarm(title, message):
    """Send notification via Pushbullet."""
    pb_key = settings.get("pb_api_key", "")
    if not pb_key:
        eel.addLog("❌ No Pushbullet API Key configured!")
        return
    
    timestamp = datetime.datetime.now().strftime("%H:%M")
    eel.addLog(f"🔔 SENDING [{title}]: {message[:30]}...")
    
    data = {
        "type": "note",
        "title": f"{title} ({timestamp})",
        "body": message
    }
    
    try:
        requests.post(
            'https://api.pushbullet.com/v2/pushes',
            headers={'Access-Token': pb_key},
            json=data
        )
    except Exception as e:
        eel.addLog(f"❌ Connection Error: {e}")

def monitor_loop():
    """Main monitoring loop."""
    global running
    s = None
    ts3_key = settings.get("ts3_api_key", "")
    filters = settings.get("filters", {})
    
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(1.0)
        eel.addLog("Connecting...")
        s.connect((DEFAULT_TS3_IP, DEFAULT_TS3_PORT))
        
        s.send(f"auth apikey={ts3_key}\n".encode('utf-8'))
        time.sleep(0.5)
        
        s.send(b"serverconnectionhandlerlist\n")
        try:
            start_response = s.recv(4096).decode('utf-8')
        except:
            start_response = ""
        
        handler_ids = list(set(re.findall(r'schandlerid=(\d+)', start_response)))
        
        if not handler_ids:
            eel.addLog("⚠️ No active tabs found.")
        else:
            eel.addLog(f"Tabs found: {handler_ids}")
        
        for hid in handler_ids:
            cmds = [
                f"clientnotifyregister schandlerid={hid} event=textchannel\n",
                f"clientnotifyregister schandlerid={hid} event=textprivate\n",
                f"clientnotifyregister schandlerid={hid} event=any\n"
            ]
            for c in cmds:
                s.send(c.encode('utf-8'))
                time.sleep(0.05)
        
        eel.addLog(f"Ready! Filtering messages from '{TARGET_NAME}'...")
        
        buffer = ""
        while running:
            try:
                data = s.recv(4096).decode('utf-8')
                if not data:
                    break
                
                buffer += data
                while "\n" in buffer:
                    line, buffer = buffer.split("\n", 1)
                    line = line.strip()
                    data_map = parse_ts3_response(line)
                    
                    if DEBUG_RAW and ("notify" in line or "error" in line):
                        eel.addLog(f"[RAW] {line[:100]}...")
                    
                    # Classification logic
                    invoker = data_map.get('invokername', '')
                    
                    if TARGET_NAME.lower() in invoker.lower():
                        raw_msg = data_map.get('msg', '')
                        success, clean_msg = clean_ts3_message(raw_msg)
                        if not success:
                            clean_msg = raw_msg
                        
                        msg_lower = clean_msg.lower()
                        
                        # Handle Pokes
                        if "notifyclientpoke" in line:
                            if "chegou sua vez no respawn" in msg_lower:
                                if filters.get("next", True):
                                    send_pushbullet_alarm("Next Respawn", clean_msg)
                            else:
                                if filters.get("poke", True):
                                    send_pushbullet_alarm("Poke", clean_msg)
                        
                        # Handle Text Messages
                        elif "notifytextmessage" in line:
                            is_death = any(x in msg_lower for x in ["died", "death", "morreu", "killed"])
                            
                            if "hunted" in msg_lower:
                                if is_death:
                                    if filters.get("hunted_death", True):
                                        send_pushbullet_alarm("Hunted Death", clean_msg)
                                else:
                                    if filters.get("hunted_up", True):
                                        send_pushbullet_alarm("Hunted Up", clean_msg)
                            
                            elif "friend" in msg_lower:
                                if is_death:
                                    if filters.get("friend_death", True):
                                        send_pushbullet_alarm("Friend Death", clean_msg)
                                else:
                                    if filters.get("friend_up", True):
                                        send_pushbullet_alarm("Friend Up", clean_msg)
            
            except socket.timeout:
                try:
                    s.send(b"\n")
                except:
                    break
                continue
            except Exception as e:
                eel.addLog(f"Loop Error: {e}")
    
    except Exception as e:
        eel.addLog(f"Connection Failed: {e}")
    
    finally:
        if s:
            s.close()
        running = False
        eel.onStopped()()

# --- MAIN ---
if __name__ == "__main__":
    eel.start('index.html', size=(720, 820), port=0)