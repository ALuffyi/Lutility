'use strict';

// ══ MISE À JOUR ══════════════════════════════════════════
let _updateData = null;

function semverGt(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i]||0) > (pb[i]||0)) return true;
    if ((pa[i]||0) < (pb[i]||0)) return false;
  }
  return false;
}

async function checkForUpdate() {
  try {
    const [data, current] = await Promise.all([window.api.checkUpdate(), window.api.getVersion()]);
    if (!data || !semverGt(data.version, current)) return;
    _updateData = data;
    const btn = document.getElementById('update-btn');
    if (btn) { btn.textContent = '↑ v' + data.version; btn.classList.remove('gone'); }
  } catch {}
}

let _updPopup = null;
let _updFilePath = null;

function openUpdatePopup(btn) {
  if (_updPopup) { _updPopup.remove(); _updPopup = null; return; }
  if (!_updateData) return;
  const p = document.createElement('div');
  p.className = 'update-popup';
  p.innerHTML = `
    <div class="update-popup-ver">↑ Version ${_updateData.version}</div>
    <div class="update-popup-notes">${_updateData.notes || 'Nouvelle version disponible.'}</div>
    <div class="upd-progress-wrap" id="upd-progress-wrap" style="display:none">
      <div class="upd-progress-track"><div class="upd-progress-bar" id="upd-progress-bar"></div></div>
      <span class="upd-progress-pct" id="upd-progress-pct">0%</span>
    </div>
    <div style="display:flex;gap:8px;margin-top:4px">
      <button class="btn sm upd-dl-btn" id="upd-dl-btn" onclick="_startDownload()">⬇️ Télécharger et installer</button>
    </div>`;
  btn.parentElement.style.position = 'relative';
  btn.parentElement.appendChild(p);
  _updPopup = p;
  // Écoute la progression (une seule fois par session)
  if (!_updProgressBound) {
    _updProgressBound = true;
    window.api.onUpdateProgress(pct => {
      const bar = document.getElementById('upd-progress-bar');
      const lbl = document.getElementById('upd-progress-pct');
      if (bar) bar.style.width = pct + '%';
      if (lbl) lbl.textContent = pct + '%';
    });
  }
  setTimeout(() => document.addEventListener('click', function h(e) {
    if (!p.contains(e.target) && e.target !== btn) { p.remove(); _updPopup = null; document.removeEventListener('click', h); }
  }), 50);
}

let _updProgressBound = false;

async function _startDownload() {
  const dlBtn = document.getElementById('upd-dl-btn');
  const wrap  = document.getElementById('upd-progress-wrap');
  if (dlBtn) { dlBtn.disabled = true; dlBtn.textContent = '⏳ Téléchargement…'; }
  if (wrap)  wrap.style.display = 'flex';
  const result = await window.api.downloadUpdate(_updateData.url);
  if (!result.ok) {
    if (dlBtn) { dlBtn.disabled = false; dlBtn.textContent = '⬇️ Réessayer'; }
    toast('❌ Téléchargement échoué : ' + (result.error || ''), 'warn');
    return;
  }
  _updFilePath = result.path;
  if (dlBtn) {
    dlBtn.disabled = false;
    dlBtn.textContent = '🚀 Installer et relancer';
    dlBtn.onclick = _installUpdate;
  }
}

function _installUpdate() {
  if (!_updFilePath) return;
  toast('Installation en cours — l\'app va se fermer…');
  setTimeout(() => window.api.installUpdate(_updFilePath), 1200);
}

// ══ PANNEAU NOTES REDIMENSIONNABLE ══════════════════════
(function _initNbResize() {
  const handle = document.getElementById('nb-resize-handle');
  const panel  = document.getElementById('nb-panel');
  if (!handle || !panel) return;

  // Restore saved width
  const saved = localStorage.getItem('nb-panel-width');
  if (saved) panel.style.width = saved + 'px';

  let _dragging = false, _startX = 0, _startW = 0;

  handle.addEventListener('mousedown', e => {
    _dragging = true;
    _startX   = e.clientX;
    _startW   = panel.offsetWidth;
    handle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!_dragging) return;
    const w = Math.min(480, Math.max(140, _startW + (e.clientX - _startX)));
    panel.style.width = w + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!_dragging) return;
    _dragging = false;
    handle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    localStorage.setItem('nb-panel-width', panel.offsetWidth);
  });
})();

// ══ HOME DASHBOARD ══════════════════════════════════════
function renderHome() {
  // Les descriptions des cartes sont statiques dans le HTML.
  // Pas de mise à jour dynamique ici.
}

// ══ HOME PERSONNALISATION ════════════════════════════════
let _homeCfg = null;
let _custModalBuilt = false;

const _HOME_CFG_DEFAULT = {
  cards: { jeux:true, notes:true, programmes:true, shortcuts:true, tools:true },
  nav:   { jeux:true, notes:true, shortcuts:true, programmes:true, tools:true, maj:true },
  prefs: { clock:true, navLabels:true },
};

async function _loadHomeCfg() {
  const cfg = await window.api.configLoad();
  const saved = cfg?.homeViz || {};
  _homeCfg = {
    cards: { ..._HOME_CFG_DEFAULT.cards, ...(saved.cards || {}) },
    nav:   { ..._HOME_CFG_DEFAULT.nav,   ...(saved.nav   || {}) },
    prefs: { ..._HOME_CFG_DEFAULT.prefs, ...(saved.prefs || {}) },
  };
}

function _saveHomeCfg() {
  window.api.configSave({ homeViz: _homeCfg });
}

// Applique : visibilité cartes/nav + préférences interface
function applyHomeCfg() {
  if (!_homeCfg) return;
  const secCards = { contenu:['jeux','notes'], apps:['programmes','shortcuts'], outils:['tools'] };

  // Cartes home
  for (const [sec, keys] of Object.entries(secCards)) {
    let any = false;
    keys.forEach(key => {
      const card = document.querySelector(`.wcard[data-p="${key}"]`);
      const on = _homeCfg.cards[key] !== false;
      if (card) card.style.display = on ? '' : 'none';
      if (on) any = true;
    });
    const secEl = document.querySelector(`.home-sec[data-sec="${sec}"]`);
    if (secEl) secEl.style.display = any ? '' : 'none';
  }

  // Boutons nav
  ['jeux','notes','shortcuts','programmes','tools','maj'].forEach(key => {
    const btn = document.getElementById('nav-' + key);
    if (btn) btn.style.display = _homeCfg.nav[key] !== false ? '' : 'none';
  });

  // Horloge
  const clock = document.getElementById('clock');
  if (clock) clock.style.display = _homeCfg.prefs.clock !== false ? '' : 'none';

  // Labels sidebar
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.toggle('no-labels', _homeCfg.prefs.navLabels === false);
}

// Rétro-compat (ancien nom appelé depuis launch.js)
function applyHomeVisibility() { applyHomeCfg(); }

function toggleHomeCustomize() {
  _initCustomModal();
  openModal('modal-customize');
}

function _initCustomModal() {
  if (_custModalBuilt) return;
  _custModalBuilt = true;
  const body = document.getElementById('cust-modal-body');
  if (!body) return;

  const CARD_ITEMS = [
    {key:'jeux',label:'🎮 Jeux'}, {key:'notes',label:'📝 Notes'},
    {key:'programmes',label:'📦 Apps'}, {key:'shortcuts',label:'🔗 Raccourcis'},
    {key:'tools',label:'⚙️ Outils'},
  ];
  const NAV_ITEMS = [
    {key:'jeux',label:'🎮 Jeux'}, {key:'notes',label:'📝 Notes'},
    {key:'shortcuts',label:'🔗 Raccourcis'}, {key:'programmes',label:'📦 Apps'},
    {key:'tools',label:'⚙️ Outils'}, {key:'maj',label:'📋 MàJ'},
  ];
  const PREF_ITEMS = [
    {key:'clock',   label:'🕐 Horloge'},
    {key:'navLabels',label:'🔤 Labels barre latérale'},
  ];

  function makeSection(title, items, type, changeCb) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="home-cust-group-lbl">${title}</div>`;
    const grid = document.createElement('div');
    grid.className = 'home-cust-grid';
    items.forEach(({ key, label }) => {
      const isOn = _homeCfg[type][key] !== false;
      const tog = document.createElement('label');
      tog.className = 'home-cust-tog' + (isOn ? ' on' : '');
      tog.innerHTML = `<input type="checkbox" ${isOn?'checked':''} style="display:none"><span>${label}</span>`;
      tog.querySelector('input').addEventListener('change', function() {
        _homeCfg[type][key] = this.checked;
        tog.classList.toggle('on', this.checked);
        changeCb && changeCb();
        _saveHomeCfg();
      });
      grid.appendChild(tog);
    });
    wrap.appendChild(grid);
    return wrap;
  }

  // Affichage Home
  body.appendChild(makeSection('Cartes du tableau de bord', CARD_ITEMS, 'cards', applyHomeCfg));
  body.appendChild(makeSection('Barre latérale', NAV_ITEMS, 'nav', applyHomeCfg));
  body.appendChild(makeSection('Interface', PREF_ITEMS, 'prefs', applyHomeCfg));

  // Comportement à la fermeture
  const fermeture = document.createElement('div');
  fermeture.innerHTML = `
    <div class="home-cust-group-lbl">Comportement à la fermeture</div>
    <div style="display:flex;gap:8px">
      <button id="close-action-min"  class="btn sm" onclick="setCloseAction('minimize')" style="flex:1;justify-content:center">🗕 Réduire dans la barre</button>
      <button id="close-action-quit" class="btn sm" onclick="setCloseAction('quit')"     style="flex:1;justify-content:center">✕ Quitter</button>
    </div>`;
  body.appendChild(fermeture);
  _updateCloseActionBtns();
}

// ══ CLOCK ═══════════════════════════════════════════════
setInterval(() => {
  const n=new Date(),p=v=>String(v).padStart(2,'0');
  const el=document.getElementById('clock');
  if(el) el.textContent=`${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`;
},1000);

// ══ TOAST ═══════════════════════════════════════════════
let _tt;
function toast(msg,type=''){const t=document.getElementById('toast');t.textContent=msg;t.className='toast '+(type);t.classList.add('on');clearTimeout(_tt);_tt=setTimeout(()=>t.classList.remove('on'),2800);}

// ══ NAV / MODALS ════════════════════════════════════════
function nav(id){
  // Stop température auto-refresh si on quitte tools
  if (typeof stopTempRefresh === 'function' && id !== 'tools') stopTempRefresh();
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.nav').forEach(b=>b.classList.remove('on'));
  document.getElementById('p-'+id).classList.add('on');
  const b=document.querySelector(`.nav[data-p="${id}"]`);
  if(b)b.classList.add('on');
  if(id==='tutos' && typeof loadTutos === 'function' && !_tutos.length) loadTutos();
}
function openModal(id){
  document.getElementById(id).classList.add('on');
  if(id==='modal-customize') { _initCustomModal(); _updateCloseActionBtns(); }
  if(id==='modal-profile'){
    document.getElementById('p-name').value=profile.name;
    selEmoji=profile.emoji;
    buildEmojiGrid('edit-emoji-grid',P_EMOJIS,selEmoji);
  }
}
function closeModal(id){
  document.getElementById(id).classList.remove('on');
  // Remettre le focus sur l'éditeur de notes si une page est active
  setTimeout(() => {
    const body = document.getElementById('note-body');
    if (body && body.contentEditable === 'true') body.focus();
  }, 50);
  // Clean up inline modal state — use typeof to avoid ReferenceError
  if (id === 'modal-inline') {
    const row = document.getElementById('inline-emoji-row');
    if (row) row.remove();
    if (typeof _emojiInputCb !== 'undefined') _emojiInputCb = null;
    if (typeof _inlineCb    !== 'undefined') _inlineCb    = null;
  }
}
document.querySelectorAll('.overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('on')}));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.querySelectorAll('.overlay.on').forEach(o=>o.classList.remove('on'));hideTbl();}});

// ══ CLOSE ACTION ════════════════════════════════════════
let _closeAction = 'minimize'; // 'minimize' | 'quit'

function setCloseAction(action) {
  _closeAction = action;
  window.api.setCloseAction(action);
  window.api.configSave({ savPath, profile, closeAction: action });
  _updateCloseActionBtns();
  toast(action === 'quit' ? '✕ Fermeture = Quitter' : '🗕 Fermeture = Réduire dans la barre');
}

function _updateCloseActionBtns() {
  const min  = document.getElementById('close-action-min');
  const quit = document.getElementById('close-action-quit');
  if (!min || !quit) return;
  min.classList.toggle('prim',  _closeAction === 'minimize');
  quit.classList.toggle('prim', _closeAction === 'quit');
}

// Initialise closeAction + visibilité home depuis la config au démarrage
(async function _initCloseAction() {
  const cfg = await window.api.configLoad();
  if (cfg?.closeAction) _closeAction = cfg.closeAction;
  window.api.setCloseAction(_closeAction);
  _updateCloseActionBtns();
  await _loadHomeCfg();
  applyHomeVisibility();
})();

// ══ PROFILE ═════════════════════════════════════════════
async function saveProfile(){
  const newName = document.getElementById('p-name').value.trim() || 'Joueur';
  const oldName = profile.name;
  profile.name  = newName;
  profile.emoji = selEmoji;

  // Si le nom change et qu'un dossier SAV existe, tenter de le renommer
  if (newName !== oldName && savPath) {
    const folderBasename = savPath.split(/[/\\]/).pop();
    if (folderBasename.startsWith('Lutility_SAV')) {
      const result = await window.api.renameSavFolder(savPath, newName);
      if (result.ok && result.path !== savPath) {
        savPath = result.path;
        toast('📁 Dossier renommé → ' + savPath.split(/[/\\]/).pop());
      }
    }
  }

  window.api.configSave({ savPath, profile });
  document.getElementById('t-name').textContent  = profile.name;
  document.getElementById('t-emoji').textContent = profile.emoji;
  closeModal('modal-profile');
  toast('✅ Profil mis à jour !');
}

// ══ CONTEXT MENU ════════════════════════════════════════
const ctxEl=document.getElementById('ctx');
function showCtx(e,items){
  e.preventDefault();e.stopPropagation();
  ctxEl.innerHTML='';
  items.forEach(item=>{
    if(item==='sep'){const s=document.createElement('div');s.className='ctx-sep';ctxEl.appendChild(s);}
    else if(item.label){const l=document.createElement('div');l.className='ctx-lbl';l.textContent=item.label;ctxEl.appendChild(l);}
    else{const el=document.createElement('div');el.className='ctx-item'+(item.danger?' danger':'');el.innerHTML=`<span class="ctx-ico">${item.ico||''}</span><span>${item.text}</span>`;el.onclick=()=>{hideCtx();item.action();};ctxEl.appendChild(el);}
  });
  ctxEl.classList.add('on');
  const x=Math.min(e.clientX,window.innerWidth-210);
  const y=Math.min(e.clientY,window.innerHeight-ctxEl.scrollHeight-10);
  ctxEl.style.left=x+'px';ctxEl.style.top=y+'px';
}
function hideCtx(){ctxEl.classList.remove('on');}
document.addEventListener('click',()=>hideCtx());

// Stocke les suggestions ortho dès que le main process les envoie (push)
let _spellInfo = null;
window.api.onSpellInfo(data => { _spellInfo = data; });

document.addEventListener('contextmenu', async e => {
  // Pas de preventDefault ici : Chromium envoie les params spell-check au process
  // main SEULEMENT si le renderer ne prévient pas le menu natif. La suppression du
  // menu natif est gérée par _evt.preventDefault() dans le handler main.
  const isEditable = e.target.isContentEditable || ['INPUT','TEXTAREA'].includes(e.target.tagName) || e.target.closest('[contenteditable]');
  // Image cliquée dans l'éditeur de notes
  const noteImg = (e.target.tagName === 'IMG' && e.target.closest('.note-body')) ? e.target : null;
  const items = [];
  if (isEditable && !noteImg) {
    // Section presse-papiers — masquée quand on clique sur une image
    items.push({ label: 'Presse-papiers' });
    items.push({ ico:'📋', text:'Coller', action: async () => { try { const t = await navigator.clipboard.readText(); document.execCommand('insertText', false, t); } catch(err) {} } });
    const sel = window.getSelection()?.toString();
    if (sel) {
      items.push({ ico:'📄', text:'Copier',  action: () => navigator.clipboard.writeText(sel) });
      items.push({ ico:'✂️', text:'Couper',  action: () => { navigator.clipboard.writeText(sel); document.execCommand('delete'); } });
    }
    items.push('sep');
    items.push({ ico:'🔤', text:'Tout sélectionner', action: () => document.execCommand('selectAll') });
  } else {
    const sel = window.getSelection()?.toString();
    if (sel) items.push({ ico:'📄', text:'Copier la sélection', action: () => navigator.clipboard.writeText(sel) });
    else      items.push({ ico:'—',  text:'Rien à copier',       action: () => {} });
  }

  // ── Suggestions orthographiques ──────────────────────────────────────────
  // L'event context-menu natif (main) arrive après le contextmenu DOM.
  // On attend 40ms — imperceptible — pour que le push spell-info soit reçu.
  await new Promise(r => setTimeout(r, 200));
  const spell = _spellInfo;
  _spellInfo = null;
  // Vérifier si le mot sélectionné est dans le dico perso (pour pouvoir le retirer)
  const dictWords    = await window.api.listDictionaryWords();
  const selectedWord = window.getSelection()?.toString().trim();
  const inCustomDict = selectedWord && dictWords.some(w => w.toLowerCase() === selectedWord.toLowerCase());

  if (spell?.misspelled) {
    items.push('sep');
    items.push({ label: '🔤 ' + spell.misspelled + ' — corrections :' });
    if (spell.suggestions?.length) {
      spell.suggestions.forEach(w => {
        items.push({ ico: '✓', text: w, action: () => window.api.replaceMisspelling(w) });
      });
    } else {
      items.push({ ico: '—', text: 'Aucune suggestion', action: () => {} });
    }
    items.push({ ico: '＋', text: 'Ajouter au dictionnaire',
      action: async () => { await window.api.addToDictionary(spell.misspelled); toast('✓ "' + spell.misspelled + '" ajouté'); }
    });
  } else if (inCustomDict) {
    items.push('sep');
    items.push({ ico: '✕', text: 'Retirer "' + selectedWord + '" du dictionnaire', danger: true,
      action: async () => { await window.api.removeFromDictionary(selectedWord); toast('"' + selectedWord + '" retiré du dictionnaire'); }
    });
  }

  const gitem = e.target.closest('.gitem');
  if (gitem) { items.push('sep'); items.push({ label:'Jeu' }); items.push({ ico:'🗑️', text:'Supprimer ce jeu', danger:true, action:()=>{ delGame(+gitem.dataset.gid); } }); }
  const nbHdr = e.target.closest('.nb-hdr');
  if (nbHdr) { const nbId = +nbHdr.dataset.id; items.push('sep'); items.push({ label:'Carnet' }); items.push({ ico:'✏️', text:'Modifier (nom + emoji)', action:()=>nbEdit(nbId) }); items.push({ ico:'🗑️', text:'Supprimer', danger:true, action:()=>nbDel(nbId,{stopPropagation:()=>{}}) }); }
  // Clic droit sur une image dans l'éditeur de notes
  const imgInNote = e.target.tagName === 'IMG' && e.target.closest('.note-body') ? e.target : null;
  if (imgInNote) {
    items.push('sep'); items.push({ label:'Image' });
    items.push({ ico:'↑', text:'Monter',    action: () => _moveImg(imgInNote, -1) });
    items.push({ ico:'↓', text:'Descendre', action: () => _moveImg(imgInNote,  1) });
    items.push({ ico:'🗑️', text:'Supprimer l\'image', danger:true, action: () => _deleteImg(imgInNote) });
  }
  // Export PDF depuis l'éditeur de notes
  const inNoteBody = e.target.closest('.note-body');
  if (inNoteBody) {
    items.push('sep');
    items.push({ ico:'📄', text:'Exporter la page en PDF', action: async () => {
      const title  = document.getElementById('note-title')?.value || 'note';
      const bodyEl = document.getElementById('note-body');
      const printDiv = document.getElementById('note-print-preview');
      if (!bodyEl || !printDiv) return;
      // Remplir le div de prévisualisation (blob: URLs déjà chargées dans cette fenêtre)
      printDiv.innerHTML = `<h1>${escHtml(title)}</h1>` + bodyEl.innerHTML;
      document.body.classList.add('pdf-exporting');
      const ok = await window.api.exportNotePdf(title);
      document.body.classList.remove('pdf-exporting');
      printDiv.innerHTML = '';
      if (ok) toast('✓ PDF exporté');
    }});
  }
  // Section/page context menu handled per-level in notes.js nbCtxMenu
  showCtx(e, items);
});

// ══ INIT ════════════════════════════════════════════════
initLaunchScreen();