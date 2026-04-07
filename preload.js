const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Window
  minimize: ()    => ipcRenderer.send('win-minimize'),
  maximize: ()    => ipcRenderer.send('win-maximize'),
  close:    ()    => ipcRenderer.send('win-close'),

  // Config (AppData)
  configLoad: ()       => ipcRenderer.invoke('config-load'),
  configSave: (data)   => ipcRenderer.invoke('config-save', data),

  // Folder
  chooseFolder: ()     => ipcRenderer.invoke('choose-folder'),
  folderExists: (p)    => ipcRenderer.invoke('folder-exists', p),

  // Folder copy
  copyFolder: (src, dest) => ipcRenderer.invoke('copy-folder', src, dest),

  // Files
  fileRead:        (p, f)    => ipcRenderer.invoke('file-read', p, f),
  fileWrite:       (p, f, c) => ipcRenderer.invoke('file-write', p, f, c),
  fileWriteBinary: (p, f, b) => ipcRenderer.invoke('file-write-binary', p, f, b),
  fileReadBinary:  (p, f)    => ipcRenderer.invoke('file-read-binary', p, f),
  fileDelete:      (p, f)    => ipcRenderer.invoke('file-delete', p, f),

  // Execute system commands
  execCmd:      (cmd, type) => ipcRenderer.invoke('exec-cmd',       cmd, type),
  execAdmin:    (cmd, type) => ipcRenderer.invoke('exec-admin',     cmd, type),
  execPsScript: (script)   => ipcRenderer.invoke('exec-ps-script',  script),

  // External programs
  openUrl:   (url)  => ipcRenderer.invoke('open-url',   url),
  launchApp: (path) => ipcRenderer.invoke('launch-app', path),
  chooseExe:    ()             => ipcRenderer.invoke('choose-exe'),
  chooseScript: ()             => ipcRenderer.invoke('choose-script'),
  renameSavFolder: (old, name) => ipcRenderer.invoke('rename-savfolder', old, name),

  // Export / Import
  exportSav: (savPath, name)     => ipcRenderer.invoke('export-sav', savPath, name),
  importSav:        (savPath) => ipcRenderer.invoke('import-sav',         savPath),
  importSavWizard:  ()        => ipcRenderer.invoke('import-sav-wizard'),
  importSavInplace: ()        => ipcRenderer.invoke('import-sav-inplace'),

  // Mise à jour
  getVersion:        () => ipcRenderer.invoke('get-version'),
  checkUpdate:       () => ipcRenderer.invoke('check-update'),
  clipboardReadImage:  ()        => ipcRenderer.invoke('clipboard-read-image'),
  clipboardWriteImage: (dataUrl) => ipcRenderer.invoke('clipboard-write-image', dataUrl),
  exportImageFile: (srcPath)       => ipcRenderer.invoke('export-image-file', srcPath),
  exportImage:     (dataUrl)       => ipcRenderer.invoke('export-image', dataUrl),
  exportNotePdf:  (title)          => ipcRenderer.invoke('export-note-pdf', title),
  getFileIcon:       (filePath) => ipcRenderer.invoke('get-file-icon', filePath),
  downloadUpdate:    (url) => ipcRenderer.invoke('download-update', url),
  installUpdate:     (filePath) => ipcRenderer.invoke('install-update', filePath),
  onUpdateProgress:  (cb) => ipcRenderer.on('update-progress', (_e, pct) => cb(pct)),

  // Correcteur orthographique — push depuis main (context-menu natif)
  onSpellInfo:        (cb) => ipcRenderer.on('spell-info', (_e, data) => cb(data)),
  replaceMisspelling:    (w) => ipcRenderer.invoke('replace-misspelling', w),
  addToDictionary:       (w) => ipcRenderer.invoke('add-to-dictionary', w),
  removeFromDictionary:  (w) => ipcRenderer.invoke('remove-from-dictionary', w),
  listDictionaryWords:   ()  => ipcRenderer.invoke('list-dictionary-words'),

  // Comportement fermeture
  setCloseAction: (action) => ipcRenderer.send('set-close-action', action),
});
