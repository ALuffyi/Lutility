const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Fenêtre
  minimize: ()    => ipcRenderer.send('win-minimize'),
  maximize: ()    => ipcRenderer.send('win-maximize'),
  close:    ()    => ipcRenderer.send('win-close'),

  // Config (AppData)
  configLoad: ()       => ipcRenderer.invoke('config-load'),
  configSave: (data)   => ipcRenderer.invoke('config-save', data),

  // Dossier SAV
  chooseFolder: ()     => ipcRenderer.invoke('choose-folder'),
  folderExists: (p)    => ipcRenderer.invoke('folder-exists', p),
  copyFolder: (src, dest) => ipcRenderer.invoke('copy-folder', src, dest),

  // Fichiers
  fileRead:        (p, f)    => ipcRenderer.invoke('file-read', p, f),
  fileWrite:       (p, f, c) => ipcRenderer.invoke('file-write', p, f, c),
  fileWriteBinary: (p, f, b) => ipcRenderer.invoke('file-write-binary', p, f, b),
  fileReadBinary:  (p, f)    => ipcRenderer.invoke('file-read-binary', p, f),
  fileDelete:      (p, f)    => ipcRenderer.invoke('file-delete', p, f),

  // Exécution commandes
  execCmd:      (cmd, type) => ipcRenderer.invoke('exec-cmd',       cmd, type),
  execAdmin:    (cmd, type) => ipcRenderer.invoke('exec-admin',     cmd, type),
  execPsScript: (script)   => ipcRenderer.invoke('exec-ps-script',  script),

  // Programmes externes
  openUrl:   (url)  => ipcRenderer.invoke('open-url',   url),
  launchApp: (path) => ipcRenderer.invoke('launch-app', path),
  chooseExe:    ()             => ipcRenderer.invoke('choose-exe'),
  chooseScript: ()             => ipcRenderer.invoke('choose-script'),
  chooseImage:    ()  => ipcRenderer.invoke('choose-image'),
  openFolder:     (p) => ipcRenderer.invoke('open-folder', p),
  readFileBase64: (p) => ipcRenderer.invoke('read-file-base64', p),
  renameSavFolder: (old, name) => ipcRenderer.invoke('rename-savfolder', old, name),

  // Export / Import
  exportSav: (savPath, name)     => ipcRenderer.invoke('export-sav', savPath, name),
  importSav:        (savPath) => ipcRenderer.invoke('import-sav',         savPath),
  importSavWizard:  ()        => ipcRenderer.invoke('import-sav-wizard'),
  importSavInplace: ()        => ipcRenderer.invoke('import-sav-inplace'),

  // Mises à jour
  getVersion:        () => ipcRenderer.invoke('get-version'),
  checkUpdate:       () => ipcRenderer.invoke('check-update'),
  downloadUpdate:    (url) => ipcRenderer.invoke('download-update', url),
  installUpdate:     (filePath) => ipcRenderer.invoke('install-update', filePath),
  onUpdateProgress:  (cb) => ipcRenderer.on('update-progress', (_e, pct) => cb(pct)),

  // Presse-papiers / images
  clipboardReadImage:  ()        => ipcRenderer.invoke('clipboard-read-image'),
  clipboardWriteImage: (dataUrl) => ipcRenderer.invoke('clipboard-write-image', dataUrl),
  exportImageFile: (srcPath)       => ipcRenderer.invoke('export-image-file', srcPath),
  exportImage:     (dataUrl)       => ipcRenderer.invoke('export-image', dataUrl),
  exportNotePdf:  (title)          => ipcRenderer.invoke('export-note-pdf', title),
  getFileIcon:       (filePath) => ipcRenderer.invoke('get-file-icon', filePath),

  // Correcteur orthographique (push depuis main via context-menu natif)
  onSpellInfo:        (cb) => ipcRenderer.on('spell-info', (_e, data) => cb(data)),
  replaceMisspelling:    (w) => ipcRenderer.invoke('replace-misspelling', w),
  addToDictionary:       (w) => ipcRenderer.invoke('add-to-dictionary', w),
  removeFromDictionary:  (w) => ipcRenderer.invoke('remove-from-dictionary', w),
  listDictionaryWords:   ()  => ipcRenderer.invoke('list-dictionary-words'),

  // Comportement fermeture
  setCloseAction: (action) => ipcRenderer.send('set-close-action', action),

  // Tutoriels
  readTutorials:          ()              => ipcRenderer.invoke('read-tutorials'),
  readUserTutorials:      (savPath)       => ipcRenderer.invoke('read-user-tutorials',   savPath),
  saveUserTutorial:       (savPath, tuto) => ipcRenderer.invoke('save-user-tutorial',    savPath, tuto),
  deleteUserTutorial:     (savPath, id)   => ipcRenderer.invoke('delete-user-tutorial',  savPath, id),
  saveTutoImage:          (savPath, b64, filename) => ipcRenderer.invoke('save-tuto-image', savPath, b64, filename),
  saveOfficialTutorial:   (tuto)          => ipcRenderer.invoke('save-official-tutorial', tuto),
  deleteOfficialTutorial: (id)            => ipcRenderer.invoke('delete-official-tutorial', id),

  // systeminformation
  siTemps: ()  => ipcRenderer.invoke('si-temps'),
  siMem:   ()  => ipcRenderer.invoke('si-mem'),
  siDisk:  ()  => ipcRenderer.invoke('si-disk'),

  // Vérification dépendances
  checkDep: (type) => ipcRenderer.invoke('check-dep', type),

  // Mode simulation utilisateur
  onUserSimMode: (cb) => ipcRenderer.on('user-sim-mode', cb),

  // Mode dev
  isDev: ipcRenderer.sendSync('is-dev-sync'),

  // Publication tutos (dev only)
  publishTutorial: (tuto) => ipcRenderer.invoke('publish-tutorial', tuto),
});
