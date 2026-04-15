const { app, BrowserWindow, ipcMain, dialog, net, Tray, Menu, nativeImage, globalShortcut, screen, shell } = require('electron');
const path = require('path');
const fs   = require('fs');

let tray = null;

// ── Mode simulation utilisateur : npx electron . --user-sim ───────────────
// Simule une instance "prod" (isDev=false, config normale) depuis le run.bat
const IS_USER_SIM = !app.isPackaged && process.argv.includes('--user-sim');

if (!app.isPackaged) {
  const folder = IS_USER_SIM ? 'lutility-user-sim' : 'lutility-dev';
  app.setPath('userData', path.join(app.getPath('appData'), folder));
}

const USER_DATA   = app.getPath('userData');
const CONFIG_NAME = app.isPackaged || IS_USER_SIM ? 'config' : 'config.dev';
const CONFIG_FILE = path.join(USER_DATA, CONFIG_NAME + '.json');
const CONFIG_BAK  = CONFIG_FILE + '.bak';

// ── Atomic write — .tmp → rename, jamais de fichier à moitié écrit ──────────
function atomicWrite(filePath, content, isBinary = false) {
  const tmp = filePath + '.tmp';
  if (isBinary) fs.writeFileSync(tmp, content);
  else          fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, filePath);
}

// ── Config ────────────────────────────────────────────
function readConfig() {
  // Essaie CONFIG_FILE, puis .bak si invalide/absent
  for (const f of [CONFIG_FILE, CONFIG_BAK]) {
    try {
      const raw  = fs.readFileSync(f, 'utf8');
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') return data;
    } catch {}
  }
  return null;
}

function writeConfig(data) {
  fs.mkdirSync(USER_DATA, { recursive: true });
  // Fusion : ne pas écraser les champs non fournis
  const existing = readConfig() || {};
  const merged = { ...existing, ...data };
  const json = JSON.stringify(merged, null, 2);
  atomicWrite(CONFIG_FILE, json);
  try { fs.copyFileSync(CONFIG_FILE, CONFIG_BAK); } catch {}
}

// Cache le bytecode V8 entre les sessions (démarrage plus rapide)
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

// ── Correcteur orthographique ─────────────────────────────────────────────────
// .dic indexé par lettre initiale, distance d'édition via Int32Array
// ~15MB en mémoire (vs ~100MB avec nspell)
let _frIndex = null; // Map<char, string[]>

function editDist(a, b) {
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 3) return 99;
  const prev = new Int32Array(lb + 1).map((_, i) => i);
  const curr = new Int32Array(lb + 1);
  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    for (let j = 1; j <= lb; j++)
      curr[j] = a[i-1] === b[j-1] ? prev[j-1] : 1 + Math.min(prev[j], curr[j-1], prev[j-1]);
    prev.set(curr);
  }
  return prev[lb];
}

function suggestFr(word, max = 6) {
  if (!_frIndex || !word) return [];
  const w = word.toLowerCase();
  const bucket = _frIndex.get(w[0]) || [];
  const scored = [];
  for (const fw of bucket) {
    if (Math.abs(fw.length - w.length) > 3) continue;
    const d = editDist(w, fw);
    if (d <= 3) scored.push({ word: fw, dist: d });
  }
  scored.sort((a, b) => a.dist - b.dist);
  return scored.slice(0, max).map(s => s.word);
}

function loadSpeller() {
  if (_frIndex) return;
  const dicPath = path.join(__dirname, 'node_modules', 'dictionary-fr', 'index.dic');
  fs.promises.readFile(dicPath, 'latin1').then(content => {
    const index = new Map();
    for (const line of content.split('\n').slice(1)) {
      const word = line.split('/')[0].trim().toLowerCase();
      if (word.length < 2) continue;
      const k = word[0];
      if (!index.has(k)) index.set(k, []);
      index.get(k).push(word);
    }
    _frIndex = index;
  }).catch(e => console.error('dict load error:', e.message));
}

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 960, minHeight: 600,
    frame: false,
    backgroundColor: '#080a0d',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
      v8CacheOptions: 'code',
      backgroundThrottling: false,
    },
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    show: false,
  });
  win.loadFile('renderer.html');
  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
    if (IS_USER_SIM) win.webContents.send('user-sim-mode');
    win.webContents.session.setSpellCheckerLanguages(['fr-FR', 'en-US']);
    win.webContents.session.setPermissionRequestHandler((_wc, permission, cb) => {
      cb(permission === 'clipboard-read' || permission === 'clipboard-sanitized-write');
    });
  });

  // Push spell-info vers le renderer — plus fiable que pull (context-menu natif arrive après contextmenu DOM)
  win.webContents.on('context-menu', (_evt, params) => {
    _evt.preventDefault(); // empêche le menu natif Electron (on a le nôtre)
    if (params.misspelledWord) {
      const frSug      = suggestFr(params.misspelledWord);
      const suggestions = frSug.length ? frSug : (params.dictionarySuggestions || []);
      win.webContents.send('spell-info', {
        misspelled:  params.misspelledWord,
        suggestions,
      });
    }
  });
  ipcMain.handle('replace-misspelling',      (_e, word) => win.webContents.replaceMisspelling(word));
  ipcMain.handle('add-to-dictionary',        (_e, word) => win.webContents.session.addWordToSpellCheckerDictionary(word));
  ipcMain.handle('remove-from-dictionary',   (_e, word) => win.webContents.session.removeWordFromSpellCheckerDictionary(word));
  ipcMain.handle('list-dictionary-words',    ()         => win.webContents.session.listWordsInSpellCheckerDictionary());
  win.on('close', (e) => {
    if (!app.isQuiting) {
      if (_closeAction === 'quit') {
        app.isQuiting = true;
      } else {
        e.preventDefault();
        win.hide();
      }
    }
  });

  const savedCfg = readConfig();
  if (savedCfg?.closeAction) _closeAction = savedCfg.closeAction;
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.ico');
  tray = new Tray(iconPath);
  tray.setToolTip('Lutility');
  const menu = Menu.buildFromTemplate([
    { label: 'Ouvrir Lutility', click: () => { win.show(); win.focus(); win.webContents.focus(); } },
    { type: 'separator' },
    { label: 'Quitter', click: () => { app.isQuiting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  tray.on('double-click', () => { win.show(); win.focus(); win.webContents.focus(); });
}

// ── QuickSearch (Ctrl+Espace) ─────────────────────────
let _cachedSavPath = null;
let qsWin = null;

function createQuickSearch() {
  qsWin = new BrowserWindow({
    width: 480, height: 500,
    frame: false, resizable: false,
    alwaysOnTop: true, skipTaskbar: true,
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload-qs.js'),
      contextIsolation: true, nodeIntegration: false,
    },
    show: false,
  });
  qsWin.loadFile('quicksearch.html');
  qsWin.on('blur',   () => qsWin?.hide());
  qsWin.on('closed', () => { qsWin = null; });
}

function toggleQuickSearch() {
  if (!qsWin || qsWin.isDestroyed()) createQuickSearch();
  if (qsWin.isVisible()) { qsWin.hide(); return; }
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  qsWin.setPosition(Math.floor((width - 480) / 2), Math.floor(height * 0.22));
  qsWin.show(); qsWin.focus();
  if (_cachedSavPath) {
    try {
      const state = JSON.parse(fs.readFileSync(path.join(_cachedSavPath, 'state.json'), 'utf8'));
      qsWin.webContents.send('qs-data', {
        notes:     (state.pages      || []).map(p => ({ id: p.id,  title: p.title || 'Sans titre', type: 'note' })),
        shortcuts: (state.shortcuts  || []).map(s => ({ id: s.id,  name: s.name,  emoji: s.emoji || '🔗', path: s.path, type: 'shortcut' })),
        scripts:   (state.customTools|| []).map(t => ({ id: t.id,  name: t.name,  ico: t.ico || '⚙️',    path: t.path || t.cmd, type: 'script' })),
      });
    } catch {}
  }
}

ipcMain.on('qs-close',      ()        => qsWin?.hide());
ipcMain.on('qs-open-note',  (_e, id)  => { qsWin?.hide(); if (win && !win.isDestroyed()) { win.show(); win.focus(); win.webContents.send('qs-open-note', id); } });
ipcMain.on('qs-nav',        (_e, pg)  => { qsWin?.hide(); if (win && !win.isDestroyed()) { win.show(); win.focus(); win.webContents.send('qs-nav', pg); } });
ipcMain.handle('qs-launch', async (_e, filePath) => {
  try { await shell.openPath(filePath); qsWin?.hide(); return { ok: true }; }
  catch(e) { return { ok: false, err: e.message }; }
});

// ── Single-instance lock ──────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      win.webContents.focus();
    }
  });
  app.whenReady().then(() => {
    loadSpeller(); createWindow(); createTray();
    const ok = globalShortcut.register('CommandOrControl+Space', toggleQuickSearch);
    if (!ok) console.warn('[Lutility] Ctrl+Space : enregistrement du raccourci global échoué');
    // Init savPath depuis config
    const cfg = readConfig();
    if (cfg?.savPath) _cachedSavPath = cfg.savPath;
  });
  app.on('will-quit', () => globalShortcut.unregisterAll());
}

app.on('window-all-closed', () => { if (app.isQuiting || _closeAction === 'quit') app.quit(); });
app.on('before-quit', () => { app.isQuiting = true; });

// ── Window controls ───────────────────────────────────
ipcMain.on('win-minimize', () => win.minimize());
ipcMain.on('win-maximize', () => win.isMaximized() ? win.unmaximize() : win.maximize());
ipcMain.on('win-close',    () => win.close());

// ── Close action (quit vs minimize to tray) ───────────
let _closeAction = 'minimize';
ipcMain.on('set-close-action', (_e, action) => { _closeAction = action; });

// ── Config IPC ────────────────────────────────────────
ipcMain.handle('config-load', () => readConfig());
ipcMain.handle('config-save', (_e, data) => {
  writeConfig(data);
  if (data?.savPath) _cachedSavPath = data.savPath;
  return true;
});

// Dialog sans parent : évite qu'il s'ouvre derrière la fenêtre frameless sur Windows.
// invalidate() force le re-rendu pour corriger l'écran noir après fermeture.
async function showDialog(options) {
  const r = await dialog.showOpenDialog(options);
  if (win && !win.isDestroyed()) {
    win.focus();
    win.webContents.invalidate();
  }
  return r;
}

// ── Folder picker ─────────────────────────────────────
ipcMain.handle('choose-folder', async () => {
  const r = await showDialog({
    title: 'Choisir le dossier de sauvegarde Lutility_SAV',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (r.canceled || !r.filePaths.length) return null;
  const base = r.filePaths[0];
  const savePath = path.join(base, 'Lutility_SAV');
  fs.mkdirSync(savePath, { recursive: true });
  return savePath;
});

// ── File I/O (path traversal guard) ──────────────────
function safeResolve(savePath, filename) {
  const base = path.resolve(savePath);
  const full = path.resolve(savePath, filename);
  if (full !== base && !full.startsWith(base + path.sep)) {
    throw new Error('Chemin non autorisé : ' + filename);
  }
  return full;
}

ipcMain.handle('file-read', (_e, savePath, filename) => {
  try { return fs.readFileSync(safeResolve(savePath, filename), 'utf8'); }
  catch { return null; }
});

ipcMain.handle('file-write', (_e, savePath, filename, content) => {
  try {
    const full = safeResolve(savePath, filename);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    atomicWrite(full, content);
    return true;
  } catch(e) { console.error('file-write', e); return false; }
});

ipcMain.handle('file-write-binary', (_e, savePath, filename, base64) => {
  try {
    const full = safeResolve(savePath, filename);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    atomicWrite(full, Buffer.from(base64, 'base64'), true);
    return true;
  } catch(e) { return false; }
});

ipcMain.handle('file-read-binary', (_e, savePath, filename) => {
  try { return fs.readFileSync(safeResolve(savePath, filename)).toString('base64'); }
  catch { return null; }
});

ipcMain.handle('folder-exists', (_e, savePath) => {
  try { return fs.existsSync(savePath) && fs.statSync(savePath).isDirectory(); }
  catch { return false; }
});

ipcMain.handle('file-delete', (_e, savePath, filename) => {
  try {
    const full = safeResolve(savePath, filename);
    if (fs.existsSync(full)) fs.unlinkSync(full);
    return true;
  } catch(e) { return false; }
});

ipcMain.handle('copy-folder', (_e, src, dest) => {
  try {
    fs.cpSync(src, dest, { recursive: true });
    return true;
  } catch(e) { console.error('copy-folder', e); return false; }
});

// ── Export / Import sauvegarde ────────────────────────
ipcMain.handle('export-sav', async (_e, savPath, profileName) => {
  const r = await showDialog({
    title: 'Choisir le dossier de destination pour la sauvegarde',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (r.canceled || !r.filePaths.length) return false;
  try {
    const safeName = profileName
      ? '_' + String(profileName).replace(/[\\/:*?"<>|]/g, '').trim()
      : '';
    const destDir = path.join(r.filePaths[0], 'Lutility_SAV' + safeName);
    fs.cpSync(savPath, destDir, { recursive: true });
    return true;
  } catch(e) { return false; }
});

ipcMain.handle('import-sav', async (_e, savPath) => {
  const r = await showDialog({
    title: 'Sélectionner le dossier Lutility_SAV à restaurer',
    properties: ['openDirectory'],
  });
  if (r.canceled || !r.filePaths.length) return null;
  try {
    fs.cpSync(r.filePaths[0], savPath, { recursive: true });
    return true;
  } catch { return null; }
});

ipcMain.handle('import-sav-wizard', async () => {
  const rSrc = await showDialog({
    title: '📂 Étape 1/2 — Sélectionner votre dossier Lutility_SAV (sauvegarde)',
    properties: ['openDirectory'],
  });
  if (rSrc.canceled || !rSrc.filePaths.length) return null;

  const rDest = await showDialog({
    title: '📁 Étape 2/2 — Choisir où installer (ex: clé USB, Documents…) — Lutility_SAV sera créé ici',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (rDest.canceled || !rDest.filePaths.length) return null;

  try {
    const destPath = path.join(rDest.filePaths[0], 'Lutility_SAV');
    fs.cpSync(rSrc.filePaths[0], destPath, { recursive: true });
    return destPath;
  } catch { return null; }
});

// Sélectionne un Lutility_SAV et retourne son chemin sans copier.
// Auto-détection : si l'utilisateur sélectionne le dossier PARENT, pointe sur Lutility_SAV.
ipcMain.handle('import-sav-inplace', async () => {
  const r = await showDialog({
    title: 'Sélectionner le dossier Lutility_SAV (ou son dossier parent)',
    properties: ['openDirectory'],
  });
  if (r.canceled || !r.filePaths.length) return null;
  let selected = r.filePaths[0];
  const child = path.join(selected, 'Lutility_SAV');
  if (fs.existsSync(child) && fs.statSync(child).isDirectory()) selected = child;
  const hasData = ['games.json','notebooks.json','notes.json','shortcuts.json'].some(f =>
    fs.existsSync(path.join(selected, f))
  );
  return hasData ? selected : null;
});

const UPDATE_CHECK_URL = 'https://raw.githubusercontent.com/ALuffyi/Lutility/main/version.json';

ipcMain.handle('get-version', () => app.getVersion());
ipcMain.handle('check-update', async () => {
  try {
    const res = await net.fetch(UPDATE_CHECK_URL);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.version || !data.url) return null;
    return data; // { version, url, notes? }
  } catch { return null; }
});

ipcMain.handle('clipboard-read-image', () => {
  try {
    const { clipboard } = require('electron');
    const img = clipboard.readImage();
    if (img.isEmpty()) return null;
    return img.toDataURL();
  } catch { return null; }
});

ipcMain.handle('clipboard-write-image', (_e, dataUrl) => {
  try {
    const { clipboard, nativeImage } = require('electron');
    const img = nativeImage.createFromDataURL(dataUrl);
    clipboard.writeImage(img);
    return true;
  } catch { return false; }
});

ipcMain.handle('export-image-file', async (_e, srcPath) => {
  try {
    const ext = path.extname(srcPath).slice(1) || 'png';
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: path.basename(srcPath),
      filters: [{ name: 'Image', extensions: [ext, 'png'] }],
    });
    if (canceled || !filePath) return false;
    fs.copyFileSync(srcPath, filePath);
    return true;
  } catch { return false; }
});

ipcMain.handle('export-image', async (_e, dataUrl) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: 'image.png',
      filters: [{ name: 'Image PNG', extensions: ['png'] }],
    });
    if (canceled || !filePath) return false;
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
    return true;
  } catch { return false; }
});

ipcMain.handle('export-note-pdf', async (_e, title) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: (title || 'note') + '.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (canceled || !filePath) return false;
    // printToPDF sur la fenêtre principale (blob: URLs déjà chargées → images incluses)
    const pdfBuf = await win.webContents.printToPDF({ pageSize: 'A4', printBackground: false });
    fs.writeFileSync(filePath, pdfBuf);
    return true;
  } catch (e) { console.error('export-note-pdf', e); return false; }
});

ipcMain.handle('get-file-icon', async (_e, filePath) => {
  try {
    const icon = await app.getFileIcon(filePath, { size: 'normal' });
    return icon.toDataURL();
  } catch { return null; }
});

ipcMain.handle('download-update', async (_e, url) => {
  const os   = require('os');
  const dest = path.join(os.tmpdir(), 'Lutility-Setup-latest.exe');
  try {
    const res = await net.fetch(url);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const total = parseInt(res.headers.get('content-length') || '0', 10);
    let downloaded = 0;
    const writeStream = fs.createWriteStream(dest);
    const reader = res.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      writeStream.write(Buffer.from(value));
      downloaded += value.length;
      if (total > 0) win?.webContents.send('update-progress', Math.round((downloaded / total) * 100));
    }
    await new Promise((resolve, reject) => { writeStream.end(); writeStream.on('finish', resolve); writeStream.on('error', reject); });
    return { ok: true, path: dest };
  } catch(e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('install-update', (_e, filePath) => {
  const { spawn } = require('child_process');
  spawn(filePath, [], { detached: true, stdio: 'ignore' }).unref();
  app.quit();
});

ipcMain.handle('open-url', (_e, url) => {
  try { require('electron').shell.openExternal(url); return true; }
  catch(e) { return false; }
});

// ── Launch external app ───────────────────────────────
ipcMain.handle('launch-app', async (_e, exePath) => {
  try {
    const ext = path.extname(exePath).toLowerCase();
    if (ext === '.ps1') {
      const { spawn } = require('child_process');
      spawn('powershell.exe', ['-NoExit', '-ExecutionPolicy', 'Bypass', '-File', exePath], {
        detached: true, stdio: 'ignore', windowsHide: false,
      }).unref();
    } else {
      // .bat / .cmd / .exe / .lnk → ShellExecute (double-clic Windows)
      const err = await require('electron').shell.openPath(exePath);
      if (err) throw new Error(err);
    }
    return true;
  } catch(e) { return false; }
});

ipcMain.handle('choose-exe', async () => {
  const r = await showDialog({
    title: 'Choisir un programme',
    filters: [{ name: 'Programmes', extensions: ['exe', 'bat', 'cmd', 'lnk'] }, { name: 'Tous', extensions: ['*'] }],
    properties: ['openFile'],
  });
  return (r.canceled || !r.filePaths.length) ? null : r.filePaths[0];
});

ipcMain.handle('choose-script', async () => {
  const r = await showDialog({
    title: 'Choisir un script',
    filters: [{ name: 'Scripts', extensions: ['bat', 'cmd', 'ps1'] }, { name: 'Tous', extensions: ['*'] }],
    properties: ['openFile'],
  });
  return (r.canceled || !r.filePaths.length) ? null : r.filePaths[0];
});

ipcMain.handle('read-file-base64', (_e, filePath) => {
  try { return fs.readFileSync(filePath).toString('base64'); }
  catch { return null; }
});

ipcMain.handle('choose-image', async () => {
  const r = await showDialog({
    title: 'Choisir une image',
    filters: [{ name: 'Images', extensions: ['png','jpg','jpeg','gif','webp'] }, { name: 'Tous', extensions: ['*'] }],
    properties: ['openFile'],
  });
  return (r.canceled || !r.filePaths.length) ? null : r.filePaths[0];
});

ipcMain.handle('rename-savfolder', (_e, oldPath, newName) => {
  try {
    if (!oldPath || !fs.existsSync(oldPath)) return { ok: false, path: oldPath };
    const parent  = path.dirname(oldPath);
    const safeName = String(newName).replace(/[\\/:*?"<>|]/g, '').trim();
    const newPath  = path.join(parent, 'Lutility_SAV' + (safeName ? '_' + safeName : ''));
    if (oldPath === newPath) return { ok: true, path: newPath };
    fs.renameSync(oldPath, newPath);
    return { ok: true, path: newPath };
  } catch(e) { return { ok: false, path: oldPath, err: e.message }; }
});

// ── Execute system commands ───────────────────────────
const { exec } = require('child_process');

// PowerShell via Base64 — UTF-8 forcé pour éviter les caractères garbled
ipcMain.handle('exec-ps-script', (_e, script) => {
  return new Promise(resolve => {
    const fullScript = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n' + script;
    const encoded = Buffer.from(fullScript, 'utf16le').toString('base64');
    exec(
      `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`,
      { timeout: 30000, maxBuffer: 2 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) resolve({ ok: false, out: stderr || err.message });
        else     resolve({ ok: true,  out: stdout.trim() });
      }
    );
  });
});

ipcMain.handle('exec-cmd', (_e, cmd, type) => {
  return new Promise(resolve => {
    const { spawn } = require('child_process');
    const os  = require('os');

    if (type === 'PS') {
      const psScript = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n' + cmd;
      const encoded  = Buffer.from(psScript, 'utf16le').toString('base64');
      try {
        spawn('powershell.exe', ['-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
          detached:    true,
          stdio:       'ignore',
          windowsHide: false,
        }).unref();
        resolve({ ok: true, out: 'Commande lancée dans un terminal PowerShell.' });
      } catch(e) {
        resolve({ ok: false, out: e.message });
      }
    } else {
      // CMD : .bat temporaire, /k = terminal reste ouvert
      const tmp = path.join(os.tmpdir(), `lutility_${Date.now()}.bat`);
      try {
        fs.writeFileSync(tmp, '@chcp 65001 > nul 2>&1\r\n' + cmd, 'utf8');
        spawn('cmd.exe', ['/k', tmp], {
          detached:    true,
          stdio:       'ignore',
          windowsHide: false,
        }).unref();
        resolve({ ok: true, out: 'Commande lancée dans un terminal CMD.' });
      } catch(e) {
        resolve({ ok: false, out: e.message });
      }
    }
  });
});

// ── Tutoriels : remote-first, cache AppData ──────────────────────────────
const TUTOS_REMOTE = 'https://raw.githubusercontent.com/ALuffyi/Lutility/main/tutorials.json';
const TUTOS_CACHE  = path.join(USER_DATA, 'tutorials-cache.json');
const TUTOS_LOCAL  = path.join(__dirname, 'tutorials.json');

ipcMain.handle('read-tutorials', async () => {
  if (!app.isPackaged) { // dev : fichier local
    try { return JSON.parse(fs.readFileSync(TUTOS_LOCAL, 'utf8')); } catch {}
    return [];
  }
  // Prod : cache d'abord (immédiat), fetch GitHub en arrière-plan pour la prochaine fois
  let cached = null;
  try { cached = JSON.parse(fs.readFileSync(TUTOS_CACHE, 'utf8')); } catch {}

  if (cached) {
    net.fetch(TUTOS_REMOTE, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (Array.isArray(data)) fs.writeFileSync(TUTOS_CACHE, JSON.stringify(data)); })
      .catch(() => {});
    return cached;
  }

  // Première installation : fetch bloquant
  try {
    const res = await net.fetch(TUTOS_REMOTE, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) { fs.writeFileSync(TUTOS_CACHE, JSON.stringify(data)); return data; }
    }
  } catch {}
  try { return JSON.parse(fs.readFileSync(TUTOS_LOCAL, 'utf8')); } catch {} // fallback bundlé
  return [];
});

ipcMain.handle('exec-admin', (_e, cmd, type) => {
  return new Promise(resolve => {
    let wrapped;
    if (type === 'PS') {
      const innerScript = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n' + cmd;
      const encoded = Buffer.from(innerScript, 'utf16le').toString('base64');
      const launchPs = `Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}' -Wait`;
      const outerEncoded = Buffer.from(launchPs, 'utf16le').toString('base64');
      wrapped = `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${outerEncoded}`;
    } else {
      // CMD admin via Start-Process (UAC)
      const cmdLine = cmd.replace(/\n/g, ' & ').replace(/"/g, '\\"');
      const launchCmd = `Start-Process cmd -Verb RunAs -ArgumentList '/c chcp 65001 > nul & ${cmdLine}' -Wait`;
      const encoded = Buffer.from(launchCmd, 'utf16le').toString('base64');
      wrapped = `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`;
    }
    exec(wrapped, { timeout: 60000 }, (err, stdout, stderr) => {
      if (err) resolve({ ok: false, out: stderr || err.message });
      else     resolve({ ok: true,  out: '✅ Exécuté en Admin.' });
    });
  });
});

// ── Mode dev (sync) ──────────────────────────────────────────────────────
ipcMain.on('is-dev-sync', (e) => { e.returnValue = !app.isPackaged && !IS_USER_SIM; });

// ── Publication tuto perso → tutorials.json (dev only) ───────────────────
ipcMain.handle('publish-tutorial', (_e, tuto) => {
  if (app.isPackaged) return { ok: false, err: 'Non disponible en production' };
  try {
    let arr = [];
    try { arr = JSON.parse(fs.readFileSync(TUTOS_LOCAL, 'utf8')); } catch {}
    const maxId = arr.reduce((m, t) => Math.max(m, typeof t.id === 'number' ? t.id : 0), 0);
    const published = { ...tuto, id: maxId + 1 };
    let copiedImages = 0, failedImages = 0;
    const imgDir = path.join(__dirname, 'tutorials-img');

    // Convertit file:/// → filename relatif + copie dans tutorials-img/
    published.steps = (published.steps || []).map(s => {
      if (!s.image?.startsWith('file://')) return s;
      const srcPath = decodeURIComponent(s.image.replace(/^file:\/\/\//,'').replace(/\//g, path.sep));
      const filename = path.basename(srcPath);
      try {
        if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
        fs.copyFileSync(srcPath, path.join(imgDir, filename));
        copiedImages++;
      } catch { failedImages++; }
      const c = { ...s, image: filename };
      if (!c.imageWidth || c.imageWidth === 100) delete c.imageWidth;
      return c;
    });

    arr.push(published);
    atomicWrite(TUTOS_LOCAL, JSON.stringify(arr, null, 2));
    return { ok: true, id: published.id, copiedImages, failedImages };
  } catch(e) { return { ok: false, err: e.message }; }
});

// ── Vérification dépendances scripts ─────────────────────────────────────
ipcMain.handle('check-dep', (_e, type) => {
  const { exec } = require('child_process');
  const cmds = {
    python: 'python --version',
    ps1:    'powershell -Command "Get-ExecutionPolicy"',
  };
  const cmd = cmds[type];
  if (!cmd) return Promise.resolve({ ok: true });
  return new Promise(resolve => {
    exec(cmd, { timeout: 5000 }, (err, stdout) => {
      if (type === 'ps1') {
        const policy = (stdout || '').trim().toLowerCase();
        resolve({ ok: policy !== 'restricted', policy: policy || 'unknown' });
      } else {
        resolve({ ok: !err });
      }
    });
  });
});

// ── systeminformation — GPU temp + RAM live ───────────────────────────────
const si = require('systeminformation');

ipcMain.handle('si-temps', async () => {
  try {
    const gpus = await si.graphics();
    const temps = gpus.controllers
      .filter(c => c.temperatureGpu != null)
      .map(c => ({ name: c.name, temp: c.temperatureGpu }));
    return { ok: true, gpus: temps };
  } catch(e) { return { ok: false, gpus: [] }; }
});

ipcMain.handle('si-disk', async () => {
  try {
    const list = await si.fsSize();
    const disks = list
      .filter(d => d.size > 0)
      .map(d => ({ fs: d.fs, mount: d.mount, size: d.size, used: d.used }));
    return { ok: true, disks };
  } catch(e) { return { ok: false, disks: [] }; }
});

ipcMain.handle('si-mem', async () => {
  try {
    const m = await si.mem();
    return {
      ok: true,
      total: m.total,
      used:  m.active,
      free:  m.free,
    };
  } catch(e) { return { ok: false }; }
});

// ── Tutoriels officiels (dev only) ───────────────────────────────────────
ipcMain.handle('save-official-tutorial', (_e, tuto) => {
  if (app.isPackaged) return { ok: false, err: 'Non disponible en production' };
  try {
    let arr = [];
    try { arr = JSON.parse(fs.readFileSync(TUTOS_LOCAL, 'utf8')); } catch {}
    const idx = arr.findIndex(t => t.id === tuto.id);
    if (idx >= 0) arr[idx] = tuto; else arr.push(tuto);
    atomicWrite(TUTOS_LOCAL, JSON.stringify(arr, null, 2));
    return { ok: true };
  } catch(e) { return { ok: false, err: e.message }; }
});

ipcMain.handle('delete-official-tutorial', (_e, id) => {
  if (app.isPackaged) return { ok: false, err: 'Non disponible en production' };
  try {
    let arr = [];
    try { arr = JSON.parse(fs.readFileSync(TUTOS_LOCAL, 'utf8')); } catch {}
    arr = arr.filter(t => t.id !== id);
    atomicWrite(TUTOS_LOCAL, JSON.stringify(arr, null, 2));
    return { ok: true };
  } catch(e) { return { ok: false, err: e.message }; }
});

// ── Tutoriels utilisateur (SAV) ───────────────────────────────────────────
ipcMain.handle('read-user-tutorials', (_e, savPath) => {
  try {
    const f = path.join(savPath, 'tutorials-user.json');
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch { return []; }
});

ipcMain.handle('save-user-tutorial', (_e, savPath, tuto) => {
  try {
    const f = path.join(savPath, 'tutorials-user.json');
    let arr = [];
    try { arr = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {}
    const idx = arr.findIndex(t => t.id === tuto.id);
    if (idx >= 0) arr[idx] = tuto; else arr.push(tuto);
    atomicWrite(f, JSON.stringify(arr, null, 2));
    return { ok: true };
  } catch(e) { return { ok: false, err: e.message }; }
});

ipcMain.handle('delete-user-tutorial', (_e, savPath, id) => {
  try {
    const f = path.join(savPath, 'tutorials-user.json');
    let arr = [];
    try { arr = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {}
    arr = arr.filter(t => t.id !== id);
    atomicWrite(f, JSON.stringify(arr, null, 2));
    return { ok: true };
  } catch(e) { return { ok: false, err: e.message }; }
});

ipcMain.handle('save-tuto-image', (_e, savPath, base64, filename) => {
  try {
    const dir = path.join(savPath, 'tutorials-img');
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, filename);
    fs.writeFileSync(dest, Buffer.from(base64, 'base64'));
    return { ok: true, path: dest };
  } catch(e) { return { ok: false, err: e.message }; }
});
