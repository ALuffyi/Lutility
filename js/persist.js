'use strict';

// ══ PERSIST (Electron) ══════════════════════════════════
// All file I/O goes through window.api (preload → main.js → Node.js fs)
// savePath est une string stockée dans AppData/config.json (+ config.json.bak)
// Toutes les écritures sont atomiques côté main.js (write .tmp → rename)

let _savDirLost  = false;
let _saving      = false;   // mutex : un seul saveAll() à la fois
let _pendingSave = false;   // un save a été demandé pendant qu'un autre tournait

// ── JSON helpers ─────────────────────────────────────────
async function wJSON(filename, data) {
  if (!savPath) { onSavDirLost(); return false; }
  // Guard : JSON.stringify(undefined) renvoie undefined (pas une string)
  // ce qui ferait planter atomicWrite côté main.js et déclencherait onSavDirLost
  const json = JSON.stringify(data ?? null, null, 2);
  const ok = await window.api.fileWrite(savPath, filename, json);
  if (!ok) { onSavDirLost(); return false; }
  if (_savDirLost) { _savDirLost = false; hideSavBanner(); }
  return true;
}

async function rJSON(filename) {
  if (!savPath) return null;
  try {
    const raw = await window.api.fileRead(savPath, filename);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return (data && typeof data === 'object') ? data : null;
  } catch { return null; }
}

// ── Folder lost handling ─────────────────────────────────
function onSavDirLost() {
  if (_savDirLost) return;   // déjà signalé, pas de doublon
  _savDirLost = true;
  setLed(true);
  showSavBanner();
}

function showSavBanner() {
  if (document.getElementById('sav-banner')) return;
  const b = document.createElement('div');
  b.id = 'sav-banner';
  b.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:8000;background:rgba(239,68,68,.95);color:#fff;display:flex;align-items:center;justify-content:center;gap:14px;padding:12px 20px;font-family:var(--body);font-size:13px;box-shadow:0 -4px 24px rgba(0,0,0,.4)';
  b.innerHTML =
    '<span style="font-size:18px">⚠️</span>' +
    '<span><strong>Dossier Lutility_SAV inaccessible</strong> — les modifications ne sont pas sauvegardées.</span>' +
    '<button onclick="repairSavDir()" style="padding:6px 16px;border-radius:6px;background:#fff;color:#ef4444;border:none;font-weight:700;cursor:pointer;font-size:13px;flex-shrink:0">🔧 Réparer</button>' +
    '<button onclick="hideSavBanner()" style="padding:6px 10px;border-radius:6px;background:rgba(255,255,255,.2);color:#fff;border:none;cursor:pointer;font-size:13px;flex-shrink:0">✕</button>';
  document.body.appendChild(b);
}

function hideSavBanner() {
  document.getElementById('sav-banner')?.remove();
}

async function repairSavDir() {
  const chosen = await window.api.chooseFolder();
  if (!chosen) return;
  savPath = chosen;
  profile.folderHint = chosen;
  await window.api.configSave({ savPath, profile });
  _savDirLost = false;
  hideSavBanner();
  await saveAll();   // migre les données en mémoire vers le nouveau dossier
  await loadAll();   // recharge et synchronise l'UI
  toast('✅ Dossier réparé — données rechargées !');
}

// ── Image storage ─────────────────────────────────────────
async function saveImg(base64DataUrl) {
  if (!savPath) return null;
  try {
    const match = base64DataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!match) return null;
    const ext      = match[1].replace('jpeg', 'jpg');
    const b64data  = match[2];
    const filename = 'images/img_' + Date.now() + '.' + ext;
    const ok = await window.api.fileWriteBinary(savPath, filename, b64data);
    return ok ? filename : null;
  } catch(e) { return null; }
}

async function readImgAsBlob(relativePath) {
  if (!savPath) return null;
  try {
    const b64 = await window.api.fileReadBinary(savPath, relativePath);
    if (!b64) return null;
    const ext  = relativePath.split('.').pop().toLowerCase();
    const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : 'image/' + ext;
    // Utilise atob + Uint8Array au lieu de fetch() pour éviter les restrictions CSP connect-src
    const binary = atob(b64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  } catch { return null; }
}

async function resolveNoteImages(bodyEl) {
  const imgs = bodyEl.querySelectorAll('img[data-src]');
  for (const img of imgs) {
    const blobUrl = await readImgAsBlob(img.dataset.src);
    if (blobUrl) { img.src = blobUrl; /* data-src conservé pour les rechargements futurs */ }
    else img.alt = '⚠ Image introuvable : ' + img.dataset.src;
  }
}

// ── Load / Save ───────────────────────────────────────────
async function loadAll() {
  const gFile  = await rJSON('games.json');
  S.games = Array.isArray(gFile) ? gFile : [];

  const nbFile = await rJSON('notebooks.json');
  const wasOldFormat = Array.isArray(nbFile) && nbFile.length > 0 && !nbFile[0].cats;
  S.notebooks = migrateNotebooks(Array.isArray(nbFile) ? nbFile : []);

  const nFile = await rJSON('notes.json');
  S.notes = wasOldFormat
    ? migrateNoteKeys(nFile && typeof nFile === 'object' ? nFile : {}, nbFile)
    : (nFile && typeof nFile === 'object' ? nFile : {});

  if (wasOldFormat) {
    await wJSON('notebooks.json', S.notebooks);
    await wJSON('notes.json',     S.notes);
  }

  const trFile = await rJSON('trash.json');
  S.trash = Array.isArray(trFile) ? trFile : [];

  const scFile = await rJSON('shortcuts.json');
  S.shortcuts = Array.isArray(scFile) ? scFile : [];

  const ctFile = await rJSON('custom-tools.json');
  S.customTools = Array.isArray(ctFile) ? ctFile : [];

  // ── Session : validation stricte des IDs pour éviter les états orphelins ──
  const ses = await rJSON('session.json') || {};

  const validGame = S.games.find(x => x.id === ses.activeGame);
  S.activeGame = validGame
    ? ses.activeGame
    : (S.games.length ? S.games[0].id : null);

  const validNB = S.notebooks.find(x => x.id === ses.activeNB);
  if (!validNB) {
    S.activeNB = S.activeCat = S.activeSec = S.activePage = S.activeSub = null;
  } else {
    S.activeNB = ses.activeNB;
    const nb = validNB;

    const validCat = nb.cats?.find(x => x.id === ses.activeCat);
    if (!validCat) {
      S.activeCat = S.activeSec = S.activePage = S.activeSub = null;
    } else {
      S.activeCat = ses.activeCat;
      const validSec = validCat.secs?.find(x => x.id === ses.activeSec);
      if (!validSec) {
        S.activeSec = S.activePage = S.activeSub = null;
      } else {
        S.activeSec = ses.activeSec;
        const validPage = validSec.pages?.find(x => x.id === ses.activePage);
        if (!validPage) {
          S.activePage = S.activeSub = null;
        } else {
          S.activePage = ses.activePage;
          const validSub = validPage.subpages?.find(x => x.id === ses.activeSub);
          S.activeSub = validSub ? ses.activeSub : null;
        }
      }
    }
  }

  renderGames(); renderNotebooks();
  if (typeof renderShortcuts   === 'function') renderShortcuts();
  if (typeof renderCustomTools === 'function') renderCustomTools();
  if (typeof loadNote === 'function') await loadNote();
  else clearEditor();
}

async function saveAll() {
  // ── Mutex : un seul saveAll() en cours à la fois ──────
  if (_saving) { _pendingSave = true; return; }
  _saving      = true;
  _pendingSave = false;

  try {
    await wJSON('games.json',     S.games);
    await wJSON('notebooks.json', S.notebooks);
    await wJSON('notes.json',     S.notes);
    await wJSON('trash.json',     S.trash);
    await wJSON('shortcuts.json',    S.shortcuts);
    await wJSON('custom-tools.json', S.customTools);
    await wJSON('session.json', {
      activeGame: S.activeGame, activeNB:   S.activeNB,
      activeCat:  S.activeCat,  activeSec:  S.activeSec,
      activePage: S.activePage, activeSub:  S.activeSub,
    });
    setLed(false);
  } catch(e) {
    console.error('saveAll error', e);
  } finally {
    _saving = false;
    // Si un save a été demandé pendant qu'on sauvegardait, on le déclenche maintenant
    if (_pendingSave) saveAll();
  }
}

async function autoSave() {
  // Le heartbeat gère déjà la détection de dossier perdu
  // autoSave se contente de sauvegarder si tout est en ordre
  if (!savPath || _savDirLost) return;
  await saveAll();
}

function startFolderHeartbeat() {
  setInterval(async () => {
    if (!savPath) return;
    const ok = await window.api.folderExists(savPath);
    if (!ok && !_savDirLost) {
      // Dossier supprimé manuellement → effacer le profil et revenir au lancement
      _savDirLost = true;
      hideSavBanner();
      setLed(false);
      try { await window.api.configSave({ savPath: null, profile: null }); } catch {}
      savPath = null;
      profile = { name: '', emoji: '🎮', folderHint: '' };
      S.games = []; S.notebooks = []; S.notes = {};
      S.trash = []; S.shortcuts = []; S.customTools = [];
      S.activeGame = null;
      S.activeNB = S.activeCat = S.activeSec = S.activePage = S.activeSub = null;
      document.getElementById('app').style.display = 'none';
      document.getElementById('launch').classList.remove('gone');
      _savDirLost = false; // reset pour permettre un futur heartbeat propre
      if (typeof initLaunchScreen === 'function') initLaunchScreen();
    } else if (ok && _savDirLost) {
      _savDirLost = false;
      hideSavBanner();
      setLed(false);
    }
  }, 5000);
}

// ── HTML → Markdown converter (for .md export) ───────────
function h2md(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  function w(n) {
    if (n.nodeType === 3) return n.textContent;
    if (n.nodeType !== 1) return '';
    const t = n.tagName.toLowerCase();
    const ch = Array.from(n.childNodes).map(w).join('');
    switch(t) {
      case 'h2': return '\n## ' + ch + '\n';
      case 'h3': return '\n### ' + ch + '\n';
      case 'strong': case 'b': return '**' + ch + '**';
      case 'em': case 'i': return '*' + ch + '*';
      case 'u': return '__' + ch + '__';
      case 's': return '~~' + ch + '~~';
      case 'code': return '`' + ch + '`';
      case 'br': return '\n';
      case 'p': return '\n' + ch + '\n';
      case 'li': return '- ' + ch + '\n';
      case 'ul': case 'ol': return '\n' + ch;
      case 'img': return '\n![img](' + (n.dataset.src || n.src) + ')\n';
      case 'th': return '| ' + ch + ' ';
      case 'td': return '| ' + ch + ' ';
      case 'tr': return ch + '|\n';
      case 'thead': case 'tbody': return ch;
      case 'table': return '\n' + ch + '\n';
      default: return ch;
    }
  }
  return w(d).replace(/\n{3,}/g, '\n\n').trim();
}

async function saveMD(title, html) {
  if (!savPath) return;
  const filename = san(title || 'note') + '.md';
  await window.api.fileWrite(savPath, filename, '# ' + title + '\n\n' + h2md(html));
}

function san(s) { return s.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').substring(0, 60) || 'note'; }
function setLed(warn) {
  const l = document.getElementById('led'), lb = document.getElementById('sav-lbl');
  if (l)  l.classList.toggle('warn', warn);
  if (lb) lb.textContent = warn ? 'Modifications…' : 'Settings';
}
