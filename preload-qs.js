const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('qs', {
  onData:   (cb) => ipcRenderer.on('qs-data', (_e, d) => cb(d)),
  launch:   (p)  => ipcRenderer.invoke('qs-launch', p),
  openNote: (id) => ipcRenderer.send('qs-open-note', id),
  nav:      (pg) => ipcRenderer.send('qs-nav', pg),
  close:    ()   => ipcRenderer.send('qs-close'),
});
