const { app, BrowserWindow, ipcMain, dialog, net, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs   = require('fs');

let tray = null;

const USER_DATA   = app.getPath('userData');
const CONFIG_FILE = path.join(USER_DATA, 'config.json');
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
  const json = JSON.stringify(data, null, 2);
  atomicWrite(CONFIG_FILE, json);
  // Copie en backup immédiatement après écriture réussie
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
    win.show();
    // Activer la correction orthographique (fr + en)
    win.webContents.session.setSpellCheckerLanguages(['fr', 'fr-FR', 'en-US']);
    // Autoriser la lecture du presse-papiers (pour coller des screenshots)
    win.webContents.session.setPermissionRequestHandler((_wc, permission, cb) => {
      cb(permission === 'clipboard-read' || permission === 'clipboard-sanitized-write');
    });
  });
  win.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault();
      win.hide();
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.ico');
  tray = new Tray(iconPath);
  tray.setToolTip('Lutility');
  const menu = Menu.buildFromTemplate([
    { label: 'Ouvrir Lutility', click: () => { win.show(); win.focus(); } },
    { type: 'separator' },
    { label: 'Quitter', click: () => { app.isQuiting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  tray.on('double-click', () => { win.show(); win.focus(); });
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
    }
  });
  app.whenReady().then(() => { createWindow(); createTray(); });
}

app.on('window-all-closed', () => { /* Ne pas quitter — on garde la tray */ });
app.on('before-quit', () => { app.isQuiting = true; });

// ── Window controls ───────────────────────────────────
ipcMain.on('win-minimize', () => win.minimize());
ipcMain.on('win-maximize', () => win.isMaximized() ? win.unmaximize() : win.maximize());
ipcMain.on('win-close',    () => win.close());

// ── Config IPC ────────────────────────────────────────
ipcMain.handle('config-load', () => readConfig());
ipcMain.handle('config-save', (_e, data) => { writeConfig(data); return true; });

// ── Folder picker ─────────────────────────────────────
ipcMain.handle('choose-folder', async () => {
  const r = await dialog.showOpenDialog(win, {
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

// ── Export / Import sauvegarde ────────────────────────
// Export : copie le dossier Lutility_SAV entier (données + images) vers [destination]/Lutility_SAV
ipcMain.handle('export-sav', async (_e, savPath) => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Choisir le dossier de destination pour la sauvegarde',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (r.canceled || !r.filePaths.length) return false;
  try {
    const destDir = path.join(r.filePaths[0], 'Lutility_SAV');
    fs.cpSync(savPath, destDir, { recursive: true });
    return true;
  } catch(e) { return false; }
});

// Import (modal profil) : choisir un dossier Lutility_SAV → écrase le dossier actuel
ipcMain.handle('import-sav', async (_e, savPath) => {
  const r = await dialog.showOpenDialog(win, {
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
  const rSrc = await dialog.showOpenDialog(win, {
    title: '📂 Étape 1/2 — Sélectionner votre dossier Lutility_SAV (sauvegarde)',
    properties: ['openDirectory'],
  });
  if (rSrc.canceled || !rSrc.filePaths.length) return null;

  // Étape 2 : sélection du dossier parent de destination
  const rDest = await dialog.showOpenDialog(win, {
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

// ── Ouvrir URL / lien Store ───────────────────────────
ipcMain.handle('open-url', (_e, url) => {
  try { require('electron').shell.openExternal(url); return true; }
  catch(e) { return false; }
});

// ── Launch external app ───────────────────────────────
ipcMain.handle('launch-app', (_e, exePath) => {
  try {
    const { spawn } = require('child_process');
    spawn(exePath, [], { shell: true, detached: true, stdio: 'ignore' }).unref();
    return true;
  } catch(e) { return false; }
});

// ── Choose .exe / .bat / .lnk ────────────────────────
ipcMain.handle('choose-exe', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Choisir un programme',
    filters: [{ name: 'Programmes', extensions: ['exe', 'bat', 'cmd', 'lnk'] }, { name: 'Tous', extensions: ['*'] }],
    properties: ['openFile'],
  });
  return (r.canceled || !r.filePaths.length) ? null : r.filePaths[0];
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
    let wrapped;
    if (type === 'PS') {
      // PS via Base64 → pas de problème d'échappement + UTF-8 garanti
      const psScript = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n' + cmd;
      const encoded  = Buffer.from(psScript, 'utf16le').toString('base64');
      wrapped = `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`;
    } else {
      // CMD : chcp 65001 force la sortie en UTF-8 dans le même processus
      const cmdLine = cmd.replace(/\n/g, ' & ');
      wrapped = `cmd /c "chcp 65001 > nul 2>&1 & ${cmdLine}"`;
    }
    exec(wrapped, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) resolve({ ok: false, out: stderr || err.message });
      else     resolve({ ok: true,  out: stdout || 'Commande executee.' });
    });
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
