# PyInstaller hook for Eel
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

# Collect all data files (eel.js, etc.)
datas = collect_data_files('eel')

# Collect all submodules
hiddenimports = collect_submodules('eel')

# Add explicit dependencies
hiddenimports += [
    'bottle',
    'bottle_websocket', 
    'gevent',
    'gevent.ssl',
    'gevent.socket',
    'geventwebsocket',
    'geventwebsocket.handler',
    'geventwebsocket.websocket',
    'geventwebsocket.protocols.base',
    'geventwebsocket.protocols.wamp',
]
