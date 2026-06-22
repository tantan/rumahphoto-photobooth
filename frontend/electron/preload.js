const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // We can add IPC communication here later, e.g. for printing
  printReady: () => ipcRenderer.send('print-ready')
});
