'use strict';

// ══ LAUNCH ══════════════════════════════════════════════

async function initLaunchScreen() {
  const cfg = await window.api.configLoad();

  if (cfg && cfg.savPath && cfg.profile) {
    profile = cfg.profile;
    savPath = cfg.savPath;

    const ok = await window.api.folderExists(savPath);
    if (ok) {
      showReturnCard();
      await _showReturnCounts();
      return;
    }
    // Dossier introuvable → écran "Localiser" (sans relancer le wizard)
    showLostCard();
    return;
  }
  showWizard();
}

// Lecture légère : affiche les compteurs sans toucher au DOM de l'app
async function _showReturnCounts() {
  try {
    setStatus('folder', 'ok', profile.folderHint || savPath);
    setStatus('data', 'warn', 'Chargement…');

    const [gRaw, nbRaw, nRaw] = await Promise.all([
      window.api.fileRead(savPath, 'games.json'),
      window.api.fileRead(savPath, 'notebooks.json'),
      window.api.fileRead(savPath, 'notes.json'),
    ]);

    let games = 0, pages = 0, notes = 0;
    try { const g = JSON.parse(gRaw||'[]'); if (Array.isArray(g)) games = g.length; } catch {}
    try {
      const nbs = JSON.parse(nbRaw||'[]');
      if (Array.isArray(nbs)) {
        nbs.forEach(nb => (nb.cats||[]).forEach(cat =>
          (cat.secs||[]).forEach(sec => pages += (sec.pages||[]).length)));
      }
    } catch {}
    try {
      const ns = JSON.parse(nRaw||'{}');
      if (ns && typeof ns === 'object') notes = Object.values(ns).filter(v => v?.content).length;
    } catch {}

    const parts = [];
    if (games) parts.push(games + ' jeu' + (games > 1 ? 'x' : ''));
    if (pages) parts.push(pages + ' page' + (pages > 1 ? 's' : ''));
    if (notes) parts.push(notes + ' note' + (notes > 1 ? 's' : ''));
    setStatus('data', 'ok', parts.length ? parts.join(' · ') : 'Vide — prêt à démarrer');
    document.getElementById('btn-open').disabled = false;
    const rep = document.getElementById('btn-repair');
    if (rep) rep.style.display = 'none';
  } catch {
    setStatus('data', 'warn', 'Impossible de lire les données');
  }
}

function showLostCard() {
  document.getElementById('card-setup').style.display  = 'none';
  document.getElementById('card-return').style.display = 'none';
  document.getElementById('card-lost').style.display   = 'flex';
  document.getElementById('lost-emoji').textContent = profile.emoji || '🎮';
  document.getElementById('lost-name').textContent  = profile.name  || 'Joueur';
}

// Pointe vers un Lutility_SAV existant (sans copie)
async function quickLocate() {
  const newPath = await window.api.importSavInplace();
  if (!newPath) return;
  savPath = newPath;
  profile.folderHint = newPath;
  await window.api.configSave({ savPath, profile });
  startApp();
}

async function quickNewFolder() {
  const chosen = await window.api.chooseFolder();
  if (!chosen) return;
  savPath = chosen;
  profile.folderHint = chosen;
  await window.api.configSave({ savPath, profile });
  startApp();
}

// ── WIZARD ───────────────────────────────────────────────
function showWizard() {
  document.getElementById('card-setup').style.display  = 'flex';
  document.getElementById('card-return').style.display = 'none';
  selEmoji = '🎮';
  buildEmojiGrid('setup-emoji-grid', P_EMOJIS, selEmoji);
  gotoWizStep(1);
}

function gotoWizStep(n) {
  [1,2,3,4].forEach(i => {
    document.getElementById('wiz-' + i).style.display = i === n ? 'flex' : 'none';
  });
  [1,2,3,4].forEach(i => {
    const dot  = document.getElementById('step-dot-' + i);
    const line = document.querySelectorAll('.step-line')[i-1];
    dot.className = 'step' + (i < n ? ' done' : i === n ? ' active' : '');
    if (line) line.className = 'step-line' + (i < n ? ' done' : '');
  });
  if (n === 4) fillWizSummary();
}

function wizNext(from) {
  if (from === 1) {
    const name = document.getElementById('s-name').value.trim();
    if (!name) {
      const inp = document.getElementById('s-name');
      inp.focus(); inp.style.borderColor = 'var(--red)';
      setTimeout(() => inp.style.borderColor = '', 1200);
      return;
    }
    profile.name  = name;
    profile.emoji = selEmoji || '🎮';
    gotoWizStep(2);
  } else if (from === 2) {
    gotoWizStep(3);
  } else if (from === 3) {
    if (!savPath) return;
    gotoWizStep(4);
  }
}

function wizBack(from) { gotoWizStep(from - 1); }

function fillWizSummary() {
  function eh(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  document.getElementById('wiz-summary').innerHTML =
    '<div class="wiz-sum-row"><span class="wiz-sum-ico">' + eh(profile.emoji||'🎮') + '</span>' +
    '<div><div class="wiz-sum-lbl">Profil</div><div class="wiz-sum-val">' + eh(profile.name||'Joueur') + '</div></div></div>' +
    '<div class="wiz-sum-row"><span class="wiz-sum-ico">📁</span>' +
    '<div><div class="wiz-sum-lbl">Dossier</div>' +
    '<div class="wiz-sum-val" style="font-size:12px;font-family:var(--mono)">' + eh(profile.folderHint||'—') + '</div></div></div>';
}

async function pickFolder(isChange) {
  await new Promise(r => setTimeout(r, 80));
  const oldPath = savPath; // mémorise avant de changer
  const chosen = await window.api.chooseFolder();
  if (!chosen) return;

  if (isChange && oldPath && oldPath !== chosen) {
    toast('📁 Copie des données…');
    await window.api.copyFolder(oldPath, chosen);
  }

  savPath = chosen;
  profile.folderHint = chosen;
  await window.api.configSave({ savPath, profile });

  if (isChange) {
    closeModal('modal-folder');
    await loadAll();
    toast('📁 Dossier mis à jour et données copiées !');
    return;
  }
  const el = document.getElementById('spath');
  if (el) { el.textContent = '✅ ' + chosen; el.classList.add('ok'); }
  const go = document.getElementById('btn-go');
  if (go) go.removeAttribute('disabled');
}

async function firstLaunch() {
  if (!savPath) return;
  profile.name  = document.getElementById('s-name').value.trim() || 'Joueur';
  profile.emoji = selEmoji || '🎮';
  await window.api.configSave({ savPath, profile });
  startApp();
}

function showReturnCard() {
  document.getElementById('card-setup').style.display  = 'none';
  document.getElementById('card-return').style.display = 'flex';
  document.getElementById('r-emoji').textContent = profile.emoji || '🎮';
  document.getElementById('r-name').textContent  = profile.name  || 'Joueur';
  setStatus('profile', 'ok', (profile.name||'Joueur') + '  ' + (profile.emoji||''));
  setStatus('folder',  'warn', 'Vérification…');
  setStatus('data',    'warn', 'Chargement…');
  document.getElementById('btn-open').disabled = true;
}

function setStatus(key, state, val) {
  const ico = document.getElementById('st-' + key + '-ico');
  const txt = document.getElementById('st-' + key + '-val');
  if (!ico || !txt) return;
  ico.className   = 'status-ico ' + state;
  ico.textContent = state === 'ok' ? '✓' : state === 'warn' ? '⚠' : '✕';
  txt.textContent = val;
}

async function returnOpen() { await startApp(); }

async function repairFolder() {
  const chosen = await window.api.chooseFolder();
  if (!chosen) return;
  savPath = chosen;
  profile.folderHint = chosen;
  await window.api.configSave({ savPath, profile });
  await _showReturnCounts();
  const rep = document.getElementById('btn-repair');
  if (rep) rep.style.display = 'none';
}

function resetSetup() {
  window.api.configSave({ savPath: null, profile: null });
  savPath  = null;
  profile  = { name: '', emoji: '🎮', folderHint: '' };
  S.games = []; S.notebooks = []; S.notes = {};
  S.trash = []; S.shortcuts = []; S.customTools = [];
  S.activeGame = null;
  S.activeNB = S.activeCat = S.activeSec = S.activePage = S.activeSub = null;
  const lostCard = document.getElementById('card-lost');
  if (lostCard) lostCard.style.display = 'none';
  showWizard();
}

// ── Export / Import ──────────────────────────────────────
async function exportSav() {
  if (!savPath) { toast('Aucun dossier configuré', 'warn'); return; }
  const ok = await window.api.exportSav(savPath, profile.name);
  if (ok) toast('✅ Sauvegarde exportée !');
  else    toast('Export annulé ou échoué', 'warn');
}

let _importChoiceResolve = null;
let _importChoiceCleanup = null;

function showImportChoice() {
  return new Promise(resolve => {
    _importChoiceResolve = resolve;
    const el = document.getElementById('modal-import-choice');

    function onBackdrop(e) { if (e.target === el) importChoiceSelect(null); }
    function onEsc(e)      { if (e.key === 'Escape' && _importChoiceResolve) importChoiceSelect(null); }

    _importChoiceCleanup = () => {
      el.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onEsc);
    };
    el.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onEsc);
    openModal('modal-import-choice');
  });
}
function importChoiceSelect(choice) {
  closeModal('modal-import-choice');
  if (_importChoiceCleanup) { _importChoiceCleanup(); _importChoiceCleanup = null; }
  if (_importChoiceResolve) { _importChoiceResolve(choice); _importChoiceResolve = null; }
}

async function importSav() {
  if (!savPath) { toast('Aucun dossier configuré', 'warn'); return; }
  closeModal('modal-folder');
  await new Promise(r => setTimeout(r, 80));
  const newPath = await window.api.importSavInplace();
  if (!newPath) { toast('Import annulé', 'warn'); return; }
  savPath = newPath;
  profile.folderHint = newPath;
  const savedProfile = await rJSON('profile.json');
  if (savedProfile?.name) {
    profile.name  = savedProfile.name;
    profile.emoji = savedProfile.emoji || profile.emoji;
    document.getElementById('t-name').textContent  = profile.name;
    document.getElementById('t-emoji').textContent = profile.emoji;
  }
  await window.api.configSave({ savPath, profile });
  await loadAll();
  if (typeof renderTools === 'function') renderTools();
  toast('✅ Dossier chargé — profil : ' + profile.name);
}

// Import depuis l'écran de lancement : pointe directement vers un Lutility_SAV (pas de copie)
async function importAndStart() {
  profile.name  = document.getElementById('s-name')?.value?.trim() || profile.name || 'Joueur';
  profile.emoji = selEmoji || profile.emoji || '🎮';

  await new Promise(r => setTimeout(r, 80)); // laisse le renderer rafraîchir avant le dialog

  const newPath = await window.api.importSavInplace();
  if (!newPath) { toast('Import annulé', 'warn'); return; }
  savPath = newPath;
  profile.folderHint = newPath;
  await window.api.configSave({ savPath, profile });
  startApp();
}

// ── startApp ─────────────────────────────────────────────
let _autoSaveTimer    = null;
let _heartbeatStarted = false;

async function startApp() {
  S.games = []; S.notebooks = []; S.notes = {};
  S.trash = []; S.shortcuts = []; S.customTools = [];
  S.activeGame = null;
  S.activeNB = S.activeCat = S.activeSec = S.activePage = S.activeSub = null;

  document.getElementById('launch').classList.add('gone');
  document.getElementById('app').style.display = 'flex';
  document.getElementById('t-name').textContent  = profile.name  || 'Joueur';
  document.getElementById('t-emoji').textContent = profile.emoji || '🎮';

  await loadAll();
  // loadAll() gère renderGames + renderNotebooks + loadNote/clearEditor
  renderTools();
  if (typeof renderProgrammes === 'function') renderProgrammes();
  if (typeof renderHome       === 'function') renderHome();

  if (!_autoSaveTimer)    _autoSaveTimer    = setInterval(autoSave, 30000);
  if (!_heartbeatStarted) { _heartbeatStarted = true; startFolderHeartbeat(); }

  setTimeout(checkForUpdate, 3000); // vérif MàJ discrète (non bloquante)
}
