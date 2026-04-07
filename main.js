const { app, BrowserWindow, ipcMain, dialog, net, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs   = require('fs');

let tray = null;

// ── Isolation dev / prod ──────────────────────────────
// En dev (npm start / run.bat) : userData séparé → verrou single-instance
// indépendant + config.dev.json distincte de la version installée
if (!app.isPackaged) {
  app.setPath('userData', path.join(app.getPath('appData'), 'lutility-dev'));
}

const USER_DATA   = app.getPath('userData');
const CONFIG_NAME = app.isPackaged ? 'config' : 'config.dev';
const CONFIG_FILE = path.join(USER_DATA, CONFIG_NAME + '.json');
const CONFIG_BAK  = CONFIG_FILE + '.bak';

// ── Atomic write ──────────────────────────────────────
// Écrit dans un .tmp puis renomme → jamais de fichier à moitié écrit
function atomicWrite(filePath, content, isBinary = false) {
  const tmp = filePath + '.tmp';
  if (isBinary) fs.writeFileSync(tmp, content);
  else          fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, filePath);
}

// ── Config ────────────────────────────────────────────
function readConfig() {
  // Essaie le fichier principal, puis le backup si invalide/absent
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
  // Fusionne avec la config existante pour ne pas écraser les champs non fournis
  const existing = readConfig() || {};
  const merged = { ...existing, ...data };
  const json = JSON.stringify(merged, null, 2);
  atomicWrite(CONFIG_FILE, json);
  try { fs.copyFileSync(CONFIG_FILE, CONFIG_BAK); } catch {}
}

// ── Window ────────────────────────────────────────────
// Accélère le démarrage : cache le bytecode V8 entre les sessions
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

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
      v8CacheOptions: 'code',        // cache bytecode → relance plus rapide
      backgroundThrottling: false,
    },
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    show: false,
  });
  win.loadFile('renderer.html');
  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
    // Activer la correction orthographique (fr + en)
    win.webContents.session.setSpellCheckerLanguages(['fr-FR', 'en-US']);
    // Autoriser la lecture du presse-papiers (pour coller des screenshots)
    win.webContents.session.setPermissionRequestHandler((_wc, permission, cb) => {
      cb(permission === 'clipboard-read' || permission === 'clipboard-sanitized-write');
    });
  });

  // Suggestions orthographiques : mode PUSH (main → renderer dès que l'event arrive)
  // Plus fiable que le pull car context-menu natif peut arriver après le contextmenu DOM
  win.webContents.on('context-menu', (_evt, params) => {
    if (params.misspelledWord) {
      win.webContents.send('spell-info', {
        misspelled:  params.misspelledWord,
        suggestions: params.dictionarySuggestions || [],
      });
    }
  });
  ipcMain.handle('replace-misspelling', (_e, word) => win.webContents.replaceMisspelling(word));
  ipcMain.handle('add-to-dictionary',   (_e, word) => win.webContents.session.addWordToSpellCheckerDictionary(word));
  win.on('close', (e) => {
    if (!app.isQuiting) {
      if (_closeAction === 'quit') {
        app.isQuiting = true;
        // laisse la fermeture se faire normalement
      } else {
        e.preventDefault();
        win.hide();
      }
    }
  });

  // Restaure le closeAction depuis la config au démarrage
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

// ── Single-instance lock ──────────────────────────────
// Empêche plusieurs instances d'écrire en même temps dans config.json
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
  app.whenReady().then(() => { createWindow(); createTray(); });
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
ipcMain.handle('config-save', (_e, data) => { writeConfig(data); return true; });

// ── Dialog helper — évite fenêtre noire + dialog caché (bug Electron/Windows frameless) ──
// Problème : avec un parent, le dialog peut s'ouvrir derrière la fenêtre sur Windows.
// Solution : ne PAS passer de parent (dialog indépendant, toujours visible),
// puis invalider le rendu pour corriger l'écran noir après fermeture.
async function showDialog(options) {
  const r = await dialog.showOpenDialog(options);   // pas de parent = dialog en avant
  if (win && !win.isDestroyed()) {
    win.focus();
    win.webContents.invalidate();   // force re-rendu (corrige écran noir frameless)
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

// ── File I/O ──────────────────────────────────────────
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
    atomicWrite(full, content);          // écriture atomique
    return true;
  } catch(e) { console.error('file-write', e); return false; }
});

ipcMain.handle('file-write-binary', (_e, savePath, filename, base64) => {
  try {
    const full = safeResolve(savePath, filename);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    atomicWrite(full, Buffer.from(base64, 'base64'), true);  // écriture atomique
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

// ── Copier un dossier entier (ex: changement de dossier SAV) ──
ipcMain.handle('copy-folder', (_e, src, dest) => {
  try {
    fs.cpSync(src, dest, { recursive: true });
    return true;
  } catch(e) { console.error('copy-folder', e); return false; }
});

// ── Export / Import sauvegarde ────────────────────────
// Export : copie le dossier Lutility_SAV entier (données + images) vers [destination]/Lutility_SAV_[Profil]
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

// Import (modal profil) : choisir un dossier Lutility_SAV → écrase le dossier actuel
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

// ── Import wizard — 1) choisir le dossier source, 2) choisir le parent destination ──
ipcMain.handle('import-sav-wizard', async () => {
  // Étape 1 : sélection du dossier Lutility_SAV source (sauvegarde existante)
  const rSrc = await showDialog({
    title: '📂 Étape 1/2 — Sélectionner votre dossier Lutility_SAV (sauvegarde)',
    properties: ['openDirectory'],
  });
  if (rSrc.canceled || !rSrc.filePaths.length) return null;

  // Étape 2 : sélection du dossier parent de destination
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

// Import en place : sélectionne un dossier Lutility_SAV et retourne son chemin sans copier
// Auto-détection : si l'utilisateur sélectionne le dossier PARENT qui contient Lutility_SAV,
// le chemin est corrigé automatiquement
ipcMain.handle('import-sav-inplace', async () => {
  const r = await showDialog({
    title: 'Sélectionner le dossier Lutility_SAV (ou son dossier parent)',
    properties: ['openDirectory'],
  });
  if (r.canceled || !r.filePaths.length) return null;
  let selected = r.filePaths[0];
  // Si le dossier choisi contient un sous-dossier Lutility_SAV, pointe dessus
  const child = path.join(selected, 'Lutility_SAV');
  if (fs.existsSync(child) && fs.statSync(child).isDirectory()) selected = child;
  // Valide : doit contenir au moins un fichier JSON Lutility
  const hasData = ['games.json','notebooks.json','notes.json','shortcuts.json'].some(f =>
    fs.existsSync(path.join(selected, f))
  );
  return hasData ? selected : null;
});

// ── Mise à jour ───────────────────────────────────────
const UPDATE_CHECK_URL = 'https://raw.githubusercontent.com/ALuffyi/Lutility/main/version.json';

ipcMain.handle('get-version', () => app.getVersion());
ipcMain.handle('check-update', async () => {
  try {
    const res = await net.fetch(UPDATE_CHECK_URL);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.version || !data.url) return null;
    return data; // { version, url, notes }
  } catch { return null; }
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

// ── Ouvrir URL / lien Store ───────────────────────────
ipcMain.handle('open-url', (_e, url) => {
  try { require('electron').shell.openExternal(url); return true; }
  catch(e) { return false; }
});

// ── Launch external app ───────────────────────────────
ipcMain.handle('launch-app', async (_e, exePath) => {
  try {
    const ext = path.extname(exePath).toLowerCase();
    if (ext === '.ps1') {
      // PowerShell : fenêtre visible, reste ouverte
      const { spawn } = require('child_process');
      spawn('powershell.exe', ['-NoExit', '-ExecutionPolicy', 'Bypass', '-File', exePath], {
        detached: true, stdio: 'ignore', windowsHide: false,
      }).unref();
    } else {
      // .bat / .cmd / .exe / .lnk → ShellExecute (identique à un double-clic)
      const err = await require('electron').shell.openPath(exePath);
      if (err) throw new Error(err);
    }
    return true;
  } catch(e) { return false; }
});

// ── Choose .exe / .bat / .lnk ────────────────────────
ipcMain.handle('choose-exe', async () => {
  const r = await showDialog({
    title: 'Choisir un programme',
    filters: [{ name: 'Programmes', extensions: ['exe', 'bat', 'cmd', 'lnk'] }, { name: 'Tous', extensions: ['*'] }],
    properties: ['openFile'],
  });
  return (r.canceled || !r.filePaths.length) ? null : r.filePaths[0];
});

// ── Choose script (.bat / .cmd / .ps1) ───────────────
ipcMain.handle('choose-script', async () => {
  const r = await showDialog({
    title: 'Choisir un script',
    filters: [{ name: 'Scripts', extensions: ['bat', 'cmd', 'ps1'] }, { name: 'Tous', extensions: ['*'] }],
    properties: ['openFile'],
  });
  return (r.canceled || !r.filePaths.length) ? null : r.filePaths[0];
});

// ── Renommer le dossier SAV (changement de profil) ────
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

// PowerShell via Base64 — force UTF-8 output pour éviter les caractères garbled
ipcMain.handle('exec-ps-script', (_e, script) => {
  return new Promise(resolve => {
    // On préfixe chaque script PS avec le forçage UTF-8 output AVANT l'encodage Base64
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
      // PowerShell : ouvre une fenêtre PowerShell visible + reste ouverte (-NoExit)
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
      // CMD : copie dans un .bat temporaire, ouvre un terminal visible (/k = reste ouvert)
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

ipcMain.handle('exec-admin', (_e, cmd, type) => {
  return new Promise(resolve => {
    let wrapped;
    if (type === 'PS') {
      // Encode la commande en Base64 pour éviter tout problème d'échappement
      const innerScript = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n' + cmd;
      const encoded = Buffer.from(innerScript, 'utf16le').toString('base64');
      const launchPs = `Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}' -Wait`;
      const outerEncoded = Buffer.from(launchPs, 'utf16le').toString('base64');
      wrapped = `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${outerEncoded}`;
    } else {
      // CMD admin via Start-Process
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
