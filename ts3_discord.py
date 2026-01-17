import tkinter as tk
from tkinter import scrolledtext
import socket
import threading
import requests
import datetime
import time
import re
# --- CONFIGURATION ---

# 1. TeamSpeak Settings
TS3_IP = '127.0.0.1'
TS3_PORT = 25639
TS3_API_KEY = 'BTWL-RFFV-KZPI-4LQD-1LER-5B85' 

# FILTER SETTINGS
TARGET_NAME = "BB-Bot"      # Exact name of the bot
TARGET_KEYWORD = ""         # Word to look for (leave empty "" to alert on EVERYTHING)
DEBUG_RAW = False           # Set True if you need to debug connection issues

# 2. Discord Settings
# PASTE YOUR NEW WEBHOOK URL BELOW
DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1462161358890991730/brplVLV89DfOZprQOZ3VSbpl0Y4Tlx5N3ZB3A1070Ufr7QO4hdeZsZV1zvZasqAVCjKp'

DISCORD_USER_ID = "289247954382880768" 

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
        # Convert [b] to ** and remove other tags
        temp = text.replace('[b]', '**').replace('[/b]', '**')
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

class TS3MonitorApp:
    def __init__(self, root):
        self.root = root
        self.root.title("TS3 Bot Watcher (Notify Edition)")
        self.root.geometry("600x450")
        
        self.running = False
        self.thread = None

        self.status_label = tk.Label(root, text="Status: STOPPED", fg="red", font=("Arial", 12, "bold"))
        self.status_label.pack(pady=10)

        btn_frame = tk.Frame(root)
        btn_frame.pack(pady=5)
        
        self.btn_start = tk.Button(btn_frame, text="RUN", command=self.start_monitoring, bg="green", fg="white", font=("Arial", 10), width=10)
        self.btn_start.pack(side=tk.LEFT, padx=5)

        self.btn_stop = tk.Button(btn_frame, text="STOP", command=self.stop_monitoring, bg="red", fg="white", font=("Arial", 10), width=10)
        self.btn_stop.pack(side=tk.LEFT, padx=5)
        self.btn_stop["state"] = "disabled"

        tk.Label(root, text="Activity Log:", font=("Arial", 8)).pack(pady=(10,0))
        self.log_area = scrolledtext.ScrolledText(root, width=70, height=18, state='disabled')
        self.log_area.pack(pady=5)

    def log(self, message):
        self.log_area.config(state='normal')
        self.log_area.insert(tk.END, message + "\n")
        self.log_area.see(tk.END)
        self.log_area.config(state='disabled')

    def send_discord_alarm(self, raw_message):
        if "YOUR_" in DISCORD_WEBHOOK_URL:
            self.log("❌ ERROR: Paste Webhook URL in script!")
            return

        success, final_msg = clean_ts3_message(raw_message)
        if not success: final_msg = raw_message

        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        
        # ADD PING IF ID EXISTS
        ping = f"<@{DISCORD_USER_ID}>" if DISCORD_USER_ID else ""
        
        data = {
            "content": f"{ping} 📢 **TS3 ALERT** ({timestamp}): {final_msg}",
            "username": "TeamSpeak Watcher"
        }
        
        try:
            requests.post(DISCORD_WEBHOOK_URL, json=data)
            self.log(f"✅ Alert Sent: {final_msg[:40]}...")
        except Exception as e:
            self.log(f"❌ Discord Error: {e}")

    def start_monitoring(self):
        if not self.running:
            self.running = True
            self.status_label.config(text="Status: RUNNING", fg="green")
            self.btn_start["state"] = "disabled"
            self.btn_stop["state"] = "normal"
            self.thread = threading.Thread(target=self.monitor_loop, daemon=True)
            self.thread.start()

    def stop_monitoring(self):
        self.running = False
        self.status_label.config(text="Status: STOPPING...", fg="orange")
        self.log("Stopping...")

    def monitor_loop(self):
        s = None
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(1.0)
            self.log(f"Connecting...")
            s.connect((TS3_IP, TS3_PORT))
            
            self.log("Authenticating...")
            s.send(f"auth apikey={TS3_API_KEY}\n".encode('utf-8'))
            time.sleep(0.5) 

            # AUTO-DISCOVERY
            s.send(b"serverconnectionhandlerlist\n")
            try: start_response = s.recv(4096).decode('utf-8')
            except: start_response = ""
            
            handler_ids = list(set(re.findall(r'schandlerid=(\d+)', start_response)))
            
            if not handler_ids:
                self.log("⚠️ No active tabs found.")
            else:
                self.log(f"Hooking into tabs: {handler_ids}")

            for hid in handler_ids:
                cmds = [
                    f"clientnotifyregister schandlerid={hid} event=textchannel\n",
                    f"clientnotifyregister schandlerid={hid} event=textprivate\n",
                    f"clientnotifyregister schandlerid={hid} event=any\n" 
                ]
                for c in cmds:
                    s.send(c.encode('utf-8'))
                    time.sleep(0.05) 

            self.log(f"Ready! Watching for '{TARGET_NAME}'...")

            buffer = ""
            while self.running:
                try:
                    data = s.recv(4096).decode('utf-8')
                    if not data: break
                    buffer += data
                    while "\n" in buffer:
                        line, buffer = buffer.split("\n", 1)
                        line = line.strip()
                        data_map = parse_ts3_response(line)

                        if DEBUG_RAW and ("notify" in line or "error" in line):
                             self.log(f"[RAW] {line[:100]}...")

                        invoker = data_map.get('invokername', '')
                        if TARGET_NAME.lower() in invoker.lower():
                            msg_content = data_map.get('msg', '')

                            if "notifyclientpoke" in line:
                                self.log(f"POKE from {invoker}")
                                self.send_discord_alarm(f"**POKE:** {msg_content}")

                            elif "notifytextmessage" in line:
                                if TARGET_KEYWORD == "" or TARGET_KEYWORD.lower() in msg_content.lower():
                                    self.log(f"MSG from {invoker}")
                                    self.send_discord_alarm(msg_content)
                except socket.timeout:
                    try: s.send(b"\n")
                    except: break
                    continue
                except Exception as e:
                    self.log(f"Error: {e}")
        
        except Exception as e:
            self.log(f"Connection Failed: {e}")
        
        finally:
            if s: s.close()
            self.running = False
            self.root.after(0, lambda: self.reset_buttons())

    def reset_buttons(self):
        self.status_label.config(text="Status: STOPPED", fg="red")
        self.btn_start["state"] = "normal"
        self.btn_stop["state"] = "disabled"

if __name__ == "__main__":
    root = tk.Tk()
    app = TS3MonitorApp(root)
    root.mainloop()