'use strict';

// ══ NOTES ════════════════════════════════════════════════
//
// Hiérarchie : Carnet > Catégorie > Section > Page > Sous-page
//
// Conteneurs (pas d'éditeur) : Carnet, Catégorie, Section
// Avec note (éditeur actif)  : Page, Sous-page
//
// Structure S.notebooks :
// [{ id, name, emoji, color,
//    cats: [{ id, name,
//      secs: [{ id, name,
//        pages: [{ id, name,
//          subpages: [{ id, name }]
//        }]
//      }]
//    }]
// }]
//
// Clé note : "nb{id}_cat{id}_s{id}_p{id}_sp{id|root}"
// ══════════════════════════════════════════════════════════

const NB_EMOJIS = ['🎮','💻','📌','📚','🔥','⚡','🎯','💡','🏆','🛡️','🎲','🎵','🌙','☀️','🔧','📊','✍️','🗒️','🏠','🎨','⚔️','🐉','🦊','💎','🚀'];
const NB_COLORS = ['#ff6b35','#00d4ff','#a855f7','#22c55e','#fbbf24','#ec4899','#06b6d4'];
const ITEM_EMOJIS = ['📂','📁','📄','🗂️','📋','📝','🗒️','📌','📍','🔖','🏷️','💡','🔥','⚡','🎯','🏆','🌟','✨','💎','🔮','🎲','🎮','💻','🔧','⚙️','🛠️','🔑','🔐','📊','📈','🎨','🖼️','🎵','🎬','📷','🌙','☀️','🌈','⭐','🚀','🌊','🌿','❤️','💙','💜','🟢','🟡','🟠','🔴','⚪'];

let _nbSelEmoji = '';
let _rnSelEmoji = '';
let _nbDragData = null;
const _collapsed  = new Set(); // stores ids of collapsed carnets/cats/secs
const _imgBlobMap = new Map(); // blobUrl → relPath (fallback quand data-src est absent)

// ═══════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════
function mkToggle(id) {
  const open = !_collapsed.has(id);
  const t = document.createElement('span');
  t.className = 'collapse-toggle';
  t.textContent = open ? '▾' : '▸';
  t.title = open ? 'Réduire' : 'Développer';
  t.style.cssText = 'font-size:10px;color:var(--dim);flex-shrink:0;padding:0 4px;cursor:pointer;transition:color .12s;user-select:none';
  t.onmouseover = () => t.style.color = 'var(--cyan)';
  t.onmouseout  = () => t.style.color = 'var(--dim)';
  t.onclick = ev => {
    ev.stopPropagation();
    if (_collapsed.has(id)) _collapsed.delete(id);
    else _collapsed.add(id);
    renderNotebooks();
  };
  return t;
}

function renderNotebooks() {
  const c = document.getElementById('nb-list');
  if (!c) return;
  c.innerHTML = '';

  if (S.activeNB !== null && S.activeNB !== undefined &&
      _collapsed.has('nb_' + S.activeNB) &&
      (S.activePage !== null || S.activeSub !== null)) {
    S.activeSec = S.activePage = S.activeSub = null;
    clearEditor();
  }

  S.notebooks.forEach(nb => {
    const grp = document.createElement('div');
    grp.className = 'nb-group';

    const hdr = document.createElement('div');
    hdr.className = 'nb-hdr lvl-nb' + (S.activeNB === nb.id ? ' on' : '');
    hdr.draggable = true;
    hdr.innerHTML =
      (nb.emoji ? '<span class="item-emoji">' + h(nb.emoji) + '</span>' : '') +
      '<span class="item-lbl" title="' + escAttr(nb.name) + '">' + h(nb.name) + '</span>' +
      '<span class="item-edit" onclick="nbEdit(' + nb.id + ')" title="Modifier">✏️</span>' +
      '<span class="item-del"  onclick="nbDel('  + nb.id + ',event)" title="Supprimer">✕</span>';
    hdr.insertBefore(mkToggle('nb_' + nb.id), hdr.querySelector('.item-lbl'));
    hdr.onclick = e => {
      if (e.target.classList.contains('item-del') || e.target.classList.contains('item-edit')) return;
      if (e.target.classList.contains('collapse-toggle')) return;
      S.activeNB = nb.id; S.activeCat = S.activeSec = S.activePage = S.activeSub = null;
      clearEditor(); renderNotebooks();
    };
    setupDrag(hdr, 'nb', { nbId: nb.id });
    grp.appendChild(hdr);

    if (_collapsed.has('nb_' + nb.id)) { c.appendChild(grp); return; }

    (nb.cats || []).forEach(cat => {
      // CATÉGORIE
      const catEl = document.createElement('div');
      catEl.className = 'nb-row lvl-cat' + (S.activeCat === cat.id && S.activeNB === nb.id ? ' on' : '');
      catEl.draggable = true;
      catEl.innerHTML =
        '<span class="item-lbl" style="padding-left:12px" title="' + escAttr(cat.name) + '">' + (cat.emoji||'📂') + ' ' + h(cat.name) + '</span>' +
        '<span class="item-edit" onclick="rnOpen(\'cat-edit\',' + nb.id + ',' + cat.id + ',0,0,\'' + escAttr(cat.name) + '\',0,\'' + escAttr(cat.emoji||'') + '\')" title="Renommer">✏️</span>' +
        '<span class="item-del"  onclick="catDel(' + nb.id + ',' + cat.id + ',event)" title="Supprimer">✕</span>';
      catEl.insertBefore(mkToggle('cat_' + cat.id), catEl.querySelector('.item-lbl'));
      catEl.onclick = e => {
        if (e.target.classList.contains('item-del') || e.target.classList.contains('item-edit')) return;
        if (e.target.classList.contains('collapse-toggle')) return;
        S.activeNB = nb.id; S.activeCat = cat.id; S.activeSec = S.activePage = S.activeSub = null;
        clearEditor(); renderNotebooks();
      };
      setupDrag(catEl, 'cat', { nbId: nb.id, catId: cat.id });
      grp.appendChild(catEl);

      if (_collapsed.has('cat_' + cat.id)) return;

      (cat.secs || []).forEach(sec => {
        const secEl = document.createElement('div');
        secEl.className = 'nb-row lvl-sec' + (S.activeSec === sec.id && S.activeCat === cat.id ? ' on' : '');
        secEl.draggable = true;
        secEl.innerHTML =
          '<span class="item-lbl" style="padding-left:24px" title="' + escAttr(sec.name) + '">' + (sec.emoji||'📁') + ' ' + h(sec.name) + '</span>' +
          '<span class="item-edit" onclick="rnOpen(\'sec-edit\',' + nb.id + ',' + cat.id + ',' + sec.id + ',0,\'' + escAttr(sec.name) + '\',0,\'' + escAttr(sec.emoji||'') + '\')" title="Renommer">✏️</span>' +
          '<span class="item-del"  onclick="secDel(' + nb.id + ',' + cat.id + ',' + sec.id + ',event)" title="Supprimer">✕</span>';
        secEl.insertBefore(mkToggle('sec_' + sec.id), secEl.querySelector('.item-lbl'));
        secEl.onclick = e => {
          if (e.target.classList.contains('item-del') || e.target.classList.contains('item-edit')) return;
          if (e.target.classList.contains('collapse-toggle')) return;
          S.activeNB = nb.id; S.activeCat = cat.id; S.activeSec = sec.id; S.activePage = S.activeSub = null;
          renderNotebooks(); loadNote();
        };
        setupDrag(secEl, 'sec', { nbId: nb.id, catId: cat.id, secId: sec.id });
        grp.appendChild(secEl);

        if (_collapsed.has('sec_' + sec.id)) return;

        (sec.pages || []).forEach(page => {
          const pageEl = document.createElement('div');
          const pageOn = S.activePage === page.id && S.activeSec === sec.id && !S.activeSub;
          pageEl.className = 'nb-row lvl-page' + (pageOn ? ' on' : '');
          pageEl.draggable = true;
          pageEl.innerHTML =
            '<span class="item-lbl" style="padding-left:36px" title="' + escAttr(page.name) + '">' + (page.emoji||'📄') + ' ' + h(page.name) + '</span>' +
            '<span class="item-edit" onclick="rnOpen(\'page-edit\',' + nb.id + ',' + cat.id + ',' + sec.id + ',' + page.id + ',\'' + escAttr(page.name) + '\',' + page.id + ',\'' + escAttr(page.emoji||'') + '\')" title="Renommer">✏️</span>' +
            '<span class="item-del"  onclick="pageDel(' + nb.id + ',' + cat.id + ',' + sec.id + ',' + page.id + ',event)" title="Supprimer">✕</span>';
          pageEl.onclick = e => {
            if (e.target.classList.contains('item-del') || e.target.classList.contains('item-edit')) return;
            S.activeNB = nb.id; S.activeCat = cat.id; S.activeSec = sec.id; S.activePage = page.id; S.activeSub = null;
            renderNotebooks(); loadNote();
          };
          setupDrag(pageEl, 'page', { nbId: nb.id, catId: cat.id, secId: sec.id, pageId: page.id });
          grp.appendChild(pageEl);

          (page.subpages || []).forEach(sub => {
            const subEl = document.createElement('div');
            const subOn = S.activeSub === sub.id && S.activePage === page.id;
            subEl.className = 'nb-row lvl-sub' + (subOn ? ' on' : '');
            subEl.draggable = true;
            subEl.innerHTML =
              '<span class="item-lbl" style="padding-left:48px" title="' + escAttr(sub.name) + '">' + (sub.emoji||'↳') + ' ' + h(sub.name) + '</span>' +
              '<span class="item-edit" onclick="rnOpen(\'sub-edit\',' + nb.id + ',' + cat.id + ',' + sec.id + ',' + page.id + ',\'' + escAttr(sub.name) + '\',' + sub.id + ',\'' + escAttr(sub.emoji||'') + '\')" title="Renommer">✏️</span>' +
              '<span class="item-del"  onclick="subDel(' + nb.id + ',' + cat.id + ',' + sec.id + ',' + page.id + ',' + sub.id + ',event)" title="Supprimer">✕</span>';
            subEl.onclick = e => {
              if (e.target.classList.contains('item-del') || e.target.classList.contains('item-edit')) return;
              S.activeNB = nb.id; S.activeCat = cat.id; S.activeSec = sec.id; S.activePage = page.id; S.activeSub = sub.id;
              renderNotebooks(); loadNote();
            };
            setupDrag(subEl, 'sub', { nbId: nb.id, catId: cat.id, secId: sec.id, pageId: page.id, subId: sub.id });
            grp.appendChild(subEl);
          });

          pageEl.oncontextmenu = e => {
            e.preventDefault(); e.stopPropagation();
            nbCtxMenu(e, [
              { label: '＋ Sous-page', action: () => rnOpen('sub-new', nb.id, cat.id, sec.id, page.id, '') },
              { label: '✏️ Renommer',  action: () => rnOpen('page-edit', nb.id, cat.id, sec.id, page.id, page.name, page.id, page.emoji||'') },
              { label: '🗑 Supprimer', danger: true, action: () => pageDel(nb.id, cat.id, sec.id, page.id, e) },
            ]);
          };
        });

        secEl.oncontextmenu = e => {
          e.preventDefault(); e.stopPropagation();
          nbCtxMenu(e, [
            { label: '＋ Page',        action: () => rnOpen('page-new', nb.id, cat.id, sec.id, 0, '') },
            { label: '✏️ Renommer',    action: () => rnOpen('sec-edit', nb.id, cat.id, sec.id, 0, sec.name, 0, sec.emoji||'') },
            { label: '🗑 Supprimer',   danger: true, action: () => secDel(nb.id, cat.id, sec.id, e) },
          ]);
        };
      });

      catEl.oncontextmenu = e => {
        e.preventDefault(); e.stopPropagation();
        nbCtxMenu(e, [
          { label: '＋ Section',      action: () => rnOpen('sec-new', nb.id, cat.id, 0, 0, '') },
          { label: '✏️ Renommer',     action: () => rnOpen('cat-edit', nb.id, cat.id, 0, 0, cat.name, 0, cat.emoji||'') },
          { label: '🗑 Supprimer',    danger: true, action: () => catDel(nb.id, cat.id, e) },
        ]);
      };
    });

    hdr.oncontextmenu = e => {
      e.preventDefault(); e.stopPropagation();
      nbCtxMenu(e, [
        { label: '＋ Catégorie',    action: () => rnOpen('cat-new', nb.id, 0, 0, 0, '') },
        { label: '✏️ Modifier',     action: () => nbEdit(nb.id) },
        { label: '🗑 Supprimer',    danger: true, action: () => nbDel(nb.id, e) },
      ]);
    };

    c.appendChild(grp);
  });
  renderTrash();
}

let _nbCtxEl = null;
function nbCtxMenu(e, items) {
  if (_nbCtxEl) _nbCtxEl.remove();
  const menu = document.createElement('div');
  menu.className = 'nb-ctx';
  menu.style.left = Math.min(e.clientX, window.innerWidth - 180) + 'px';
  menu.style.top  = Math.min(e.clientY, window.innerHeight - items.length * 34 - 8) + 'px';
  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'nb-ctx-item' + (item.danger ? ' danger' : '');
    el.textContent = item.label;
    el.onclick = () => { menu.remove(); _nbCtxEl = null; item.action(); };
    menu.appendChild(el);
  });
  document.body.appendChild(menu);
  _nbCtxEl = menu;
  setTimeout(() => document.addEventListener('mousedown', function dismiss(ev) {
    if (!menu.contains(ev.target)) { menu.remove(); _nbCtxEl = null; document.removeEventListener('mousedown', dismiss); }
  }), 0);
}

function h(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escAttr(s) { return h(s).replace(/'/g,"\\'"); }

// ═══════════════════════════════════════════════════════
// DRAG & DROP
// ═══════════════════════════════════════════════════════
function setupDrag(el, type, data) {
  el.addEventListener('dragstart', e => {
    _nbDragData = { type, ...data };
    e.dataTransfer.effectAllowed = 'move';
    el.style.opacity = '0.4';
  });
  el.addEventListener('dragend',   () => { el.style.opacity = ''; _nbDragData = null; });
  el.addEventListener('dragover',  e  => { e.preventDefault(); el.style.background = 'rgba(0,212,255,.08)'; });
  el.addEventListener('dragleave', () => { el.style.background = ''; });
  el.addEventListener('drop', e => {
    e.preventDefault(); el.style.background = '';
    if (!_nbDragData) return;
    nbDropHandle(_nbDragData, { type, ...data });
  });
}

function _migrateNoteKeys(oldPrefix, newPrefix) {
  if (oldPrefix === newPrefix) return;
  Object.keys(S.notes).forEach(k => {
    if (k === oldPrefix || k.startsWith(oldPrefix + '_')) {
      const newKey = newPrefix + k.slice(oldPrefix.length);
      S.notes[newKey] = S.notes[k];
      delete S.notes[k];
    }
  });
}

function nbDropHandle(src, tgt) {
  const getSec  = (nbId,catId,secId) => S.notebooks.find(x=>x.id===nbId)?.cats.find(x=>x.id===catId)?.secs.find(x=>x.id===secId);
  const getPage = (nbId,catId,secId,pageId) => getSec(nbId,catId,secId)?.pages.find(x=>x.id===pageId);
  const reorder = (arr,srcId,tgtId) => { const si=arr.findIndex(x=>x.id===srcId),ti=arr.findIndex(x=>x.id===tgtId); if(si>=0&&ti>=0&&si!==ti){const[m]=arr.splice(si,1);arr.splice(ti,0,m);} };

  if (src.type === tgt.type) {
    if (src.type === 'nb') reorder(S.notebooks, src.nbId, tgt.nbId);
    else if (src.type === 'cat' && src.nbId === tgt.nbId) { const nb=S.notebooks.find(x=>x.id===src.nbId); if(nb)reorder(nb.cats,src.catId,tgt.catId); }
    else if (src.type === 'sec' && src.catId === tgt.catId) { const cat=S.notebooks.find(x=>x.id===src.nbId)?.cats.find(x=>x.id===src.catId); if(cat)reorder(cat.secs,src.secId,tgt.secId); }
    else if (src.type === 'page' && src.secId === tgt.secId) { const sec=getSec(src.nbId,src.catId,src.secId); if(sec)reorder(sec.pages,src.pageId,tgt.pageId); }
    else if (src.type === 'sub'  && src.pageId === tgt.pageId) { const page=getPage(src.nbId,src.catId,src.secId,src.pageId); if(page)reorder(page.subpages,src.subId,tgt.subId); }
    // Cross moves
    else if (src.type === 'page' && src.secId !== tgt.secId) {
      // Déplacement cross-section
      const ss=getSec(src.nbId,src.catId,src.secId), ts=getSec(tgt.nbId,tgt.catId,tgt.secId);
      if(ss&&ts){const i=ss.pages.findIndex(x=>x.id===src.pageId);if(i>=0){const[m]=ss.pages.splice(i,1);ts.pages.push(m);
        _migrateNoteKeys(
          'nb'+src.nbId+'_cat'+src.catId+'_s'+src.secId+'_p'+src.pageId,
          'nb'+tgt.nbId+'_cat'+tgt.catId+'_s'+tgt.secId+'_p'+src.pageId
        );
      }}
    } else if (src.type === 'sub' && src.pageId !== tgt.pageId) {
      const sp=getPage(src.nbId,src.catId,src.secId,src.pageId), tp=getPage(tgt.nbId,tgt.catId,tgt.secId,tgt.pageId);
      if(sp&&tp){const i=sp.subpages.findIndex(x=>x.id===src.subId);if(i>=0){const[m]=sp.subpages.splice(i,1);tp.subpages.push(m);
        const oldKey='nb'+src.nbId+'_cat'+src.catId+'_s'+src.secId+'_p'+src.pageId+'_sp'+src.subId;
        const newKey='nb'+tgt.nbId+'_cat'+tgt.catId+'_s'+tgt.secId+'_p'+tgt.pageId+'_sp'+src.subId;
        _migrateNoteKeys(oldKey, newKey);
      }}
    }
  }
  // Promouvoir sub → page
  else if (src.type==='sub' && tgt.type==='sec') {
    const sp=getPage(src.nbId,src.catId,src.secId,src.pageId), ts=getSec(tgt.nbId,tgt.catId,tgt.secId);
    if(sp&&ts){const i=sp.subpages.findIndex(x=>x.id===src.subId);if(i>=0){const[m]=sp.subpages.splice(i,1);ts.pages.push({id:m.id,name:m.name,subpages:[]});
      const oldKey='nb'+src.nbId+'_cat'+src.catId+'_s'+src.secId+'_p'+src.pageId+'_sp'+src.subId;
      const newKey='nb'+tgt.nbId+'_cat'+tgt.catId+'_s'+tgt.secId+'_p'+src.subId+'_sproot';
      _migrateNoteKeys(oldKey, newKey);
    }}
  }
  // Promouvoir page → section
  else if (src.type==='page' && tgt.type==='cat') {
    const ss=getSec(src.nbId,src.catId,src.secId), tc=S.notebooks.find(x=>x.id===tgt.nbId)?.cats.find(x=>x.id===tgt.catId);
    if(ss&&tc){const i=ss.pages.findIndex(x=>x.id===src.pageId);if(i>=0){const[m]=ss.pages.splice(i,1);
      // Preserve subpages as pages inside the new section
      const subpagesAsPages = (m.subpages||[]).map(sp=>({id:sp.id,name:sp.name,subpages:[]}));
      tc.secs.push({id:m.id,name:m.name,pages:subpagesAsPages});
      // Migre les clés de notes : page → section, sous-pages → pages
      const oldPageKey='nb'+src.nbId+'_cat'+src.catId+'_s'+src.secId+'_p'+src.pageId+'_sproot';
      const newSecKey ='nb'+tgt.nbId+'_cat'+tgt.catId+'_s'+src.pageId+'_sec';
      if(S.notes[oldPageKey]){S.notes[newSecKey]=S.notes[oldPageKey];delete S.notes[oldPageKey];}
      (m.subpages||[]).forEach(sp=>{
        const oldSpKey ='nb'+src.nbId+'_cat'+src.catId+'_s'+src.secId+'_p'+src.pageId+'_sp'+sp.id;
        const newPageKey='nb'+tgt.nbId+'_cat'+tgt.catId+'_s'+src.pageId+'_p'+sp.id+'_sproot';
        if(S.notes[oldSpKey]){S.notes[newPageKey]=S.notes[oldSpKey];delete S.notes[oldSpKey];}
      });
    }}
  }

  renderNotebooks(); saveAll();
}

// ═══════════════════════════════════════════════════════
// NOTEBOOK CRUD
// ═══════════════════════════════════════════════════════
function addNotebook() {
  _nbSelEmoji = '';
  document.getElementById('nb-mode').value = 'create';
  document.getElementById('nb-edit-id').value = '';
  document.getElementById('nb-modal-title').textContent = '📓 Nouveau carnet';
  document.getElementById('nb-confirm-btn').textContent = 'Créer';
  document.getElementById('nb-name').value = '';
  document.getElementById('nb-emoji-preview').textContent = '';
  buildNbEmojiGrid();
  openModal('modal-nb');
  setTimeout(() => document.getElementById('nb-name').focus(), 80);
}

function nbEdit(id) {
  const nb = S.notebooks.find(x => x.id === id); if (!nb) return;
  _nbSelEmoji = nb.emoji || '';
  document.getElementById('nb-mode').value = 'edit';
  document.getElementById('nb-edit-id').value = id;
  document.getElementById('nb-modal-title').textContent = '✏️ Modifier le carnet';
  document.getElementById('nb-confirm-btn').textContent = 'Enregistrer';
  document.getElementById('nb-name').value = nb.name;
  document.getElementById('nb-emoji-preview').textContent = _nbSelEmoji;
  buildNbEmojiGrid();
  openModal('modal-nb');
  setTimeout(() => document.getElementById('nb-name').select(), 80);
}

function buildNbEmojiGrid() {
  const grid = document.getElementById('nb-emoji-grid'); grid.innerHTML = '';
  NB_EMOJIS.forEach(e => {
    const btn = document.createElement('span');
    btn.textContent = e;
    btn.style.cssText = 'font-size:20px;cursor:pointer;padding:4px;border-radius:6px;border:1px solid transparent;transition:all .15s';
    if (e === _nbSelEmoji) { btn.style.borderColor='var(--cyan)'; btn.style.background='rgba(0,212,255,.12)'; }
    btn.onclick = () => nbPickEmoji(e);
    grid.appendChild(btn);
  });
  const noBtn = document.getElementById('nb-no-emoji');
  if (noBtn) { noBtn.style.borderColor=_nbSelEmoji?'var(--bord2)':'var(--cyan)'; noBtn.style.color=_nbSelEmoji?'var(--dim)':'var(--cyan)'; }
}

function nbPickEmoji(e) { _nbSelEmoji=e; document.getElementById('nb-emoji-preview').textContent=e; buildNbEmojiGrid(); }

function nbConfirm() {
  const name = document.getElementById('nb-name').value.trim();
  if (!name) { toast('Entrez un nom','warn'); return; }
  if (document.getElementById('nb-mode').value === 'edit') {
    const nb = S.notebooks.find(x=>x.id===+document.getElementById('nb-edit-id').value);
    if (nb) { nb.name=name; nb.emoji=_nbSelEmoji; }
  } else {
    S.notebooks.push({ id:Date.now(), name, emoji:_nbSelEmoji, color:NB_COLORS[S.notebooks.length%NB_COLORS.length], cats:[] });
  }
  closeModal('modal-nb'); renderNotebooks(); saveAll();
  // Refresh path display if this notebook is active
  if (document.getElementById('note-sp')) updatePath();
}

function nbDel(id, e) {
  e.stopPropagation();
  if (!confirm('Supprimer ce carnet et tout son contenu ?')) return;
  const nb = S.notebooks.find(x=>x.id===id);
  if (nb) trashPush('carnet', nb.name, JSON.parse(JSON.stringify(nb)), null);
  S.notebooks = S.notebooks.filter(x=>x.id!==id);
  if (S.activeNB===id) { S.activeNB=S.activeCat=S.activeSec=S.activePage=S.activeSub=null; clearEditor(); }
  renderNotebooks(); saveAll(); renderTrash();
}

// ═══════════════════════════════════════════════════════
// RENAME MODAL
// rnOpen(type, nbId, catId, secId, pageId, name, subId?)
// ═══════════════════════════════════════════════════════
function buildRnEmojiGrid() {
  const grid = document.getElementById('rn-emoji-grid'); if (!grid) return;
  grid.innerHTML = '';
  ITEM_EMOJIS.forEach(e => {
    const btn = document.createElement('span');
    btn.textContent = e;
    btn.style.cssText = 'font-size:18px;cursor:pointer;padding:3px;border-radius:5px;border:1px solid transparent;transition:all .15s';
    if (e === _rnSelEmoji) { btn.style.borderColor='var(--cyan)'; btn.style.background='rgba(0,212,255,.12)'; }
    btn.onclick = () => rnPickEmoji(e);
    grid.appendChild(btn);
  });
  const noBtn = document.getElementById('rn-no-emoji');
  if (noBtn) { noBtn.style.color = _rnSelEmoji ? 'var(--dim)' : 'var(--cyan)'; }
}

function rnPickEmoji(e) {
  _rnSelEmoji = e;
  const prev = document.getElementById('rn-emoji-preview');
  if (prev) prev.textContent = e;
  buildRnEmojiGrid();
}

function rnOpen(type, nbId, catId, secId, pageId, currentName, subId, currentEmoji) {
  document.getElementById('rn-type').value = type;
  document.getElementById('rn-nb').value   = nbId   || 0;
  document.getElementById('rn-sec').value  = catId  || 0;
  document.getElementById('rn-sub').value  = secId  || 0;
  const inp = document.getElementById('rn-name');
  inp.dataset.pageId = pageId || 0;
  inp.dataset.subId  = subId  || 0;
  const labels = {
    'cat-new':'Nouvelle catégorie','cat-edit':'Renommer la catégorie',
    'sec-new':'Nouvelle section',  'sec-edit':'Renommer la section',
    'page-new':'Nouvelle page',    'page-edit':'Renommer la page',
    'sub-new':'Nouvelle sous-page','sub-edit':'Renommer la sous-page',
  };
  document.getElementById('rn-title').textContent = labels[type] || 'Renommer';
  inp.value = currentName || '';
  _rnSelEmoji = currentEmoji || '';
  const emojiSection = document.getElementById('rn-emoji-section');
  const showEmoji = type.endsWith('-edit') || type.endsWith('-new');
  if (emojiSection) emojiSection.style.display = showEmoji ? 'block' : 'none';
  if (showEmoji) {
    const prev = document.getElementById('rn-emoji-preview');
    if (prev) prev.textContent = _rnSelEmoji;
    buildRnEmojiGrid();
  }
  openModal('modal-rename');
  setTimeout(() => { inp.focus(); inp.select(); }, 80);
}

function rnConfirm() {
  const name   = document.getElementById('rn-name').value.trim();
  if (!name) { toast('Entrez un nom','warn'); return; }
  const type   = document.getElementById('rn-type').value;
  const nbId   = +document.getElementById('rn-nb').value;
  const catId  = +document.getElementById('rn-sec').value;
  const secId  = +document.getElementById('rn-sub').value;
  const inp    = document.getElementById('rn-name');
  const pageId = +inp.dataset.pageId;
  const subId  = +inp.dataset.subId;
  const nb   = S.notebooks.find(x=>x.id===nbId);
  const cat  = nb?.cats.find(x=>x.id===catId);
  const sec  = cat?.secs.find(x=>x.id===secId);
  const page = sec?.pages.find(x=>x.id===pageId);

  const emoji = _rnSelEmoji || undefined;
  if      (type==='cat-new')  nb?.cats.push({id:Date.now(),name,emoji,secs:[]});
  else if (type==='cat-edit') { if(cat){cat.name=name;cat.emoji=emoji;} }
  else if (type==='sec-new')  cat?.secs.push({id:Date.now(),name,emoji,pages:[]});
  else if (type==='sec-edit') { if(sec){sec.name=name;sec.emoji=emoji;} }
  else if (type==='page-new') sec?.pages.push({id:Date.now(),name,emoji,subpages:[]});
  else if (type==='page-edit'){ if(page){page.name=name;page.emoji=emoji;} }
  else if (type==='sub-new')  page?.subpages.push({id:Date.now(),name,emoji});
  else if (type==='sub-edit') { const sub=page?.subpages.find(x=>x.id===subId); if(sub){sub.name=name;sub.emoji=emoji;} }

  closeModal('modal-rename'); renderNotebooks(); saveAll();

  // Met à jour le titre dans l'éditeur si le niveau actif vient d'être renommé
  const isActiveEdit = (
    (type === 'sec-edit'  && secId  === S.activeSec  && !S.activePage) ||
    (type === 'page-edit' && pageId === S.activePage && !S.activeSub)  ||
    (type === 'sub-edit'  && subId  === S.activeSub)
  );
  if (isActiveEdit) {
    const titleEl = document.getElementById('note-title');
    const k = nKey();
    const n = S.notes[k];
    if (!n || !n.title || n.title === titleEl.value) {
      titleEl.value = name;
    }
    updatePath();
  }
}

function catDel(nbId,catId,e){ e.stopPropagation(); if(!confirm('Supprimer cette catégorie ?'))return; const nb=S.notebooks.find(x=>x.id===nbId); const cat=nb?.cats.find(x=>x.id===catId); if(cat)trashPush('catégorie',cat.name,JSON.parse(JSON.stringify(cat)),{nbId}); if(nb)nb.cats=nb.cats.filter(x=>x.id!==catId); if(S.activeCat===catId){S.activeCat=S.activeSec=S.activePage=S.activeSub=null;clearEditor();} renderNotebooks();saveAll();renderTrash(); }
function secDel(nbId,catId,secId,e){ e.stopPropagation(); if(!confirm('Supprimer cette section ?'))return; const cat=S.notebooks.find(x=>x.id===nbId)?.cats.find(x=>x.id===catId); const sec=cat?.secs.find(x=>x.id===secId); if(sec)trashPush('section',sec.name,JSON.parse(JSON.stringify(sec)),{nbId,catId}); if(cat)cat.secs=cat.secs.filter(x=>x.id!==secId); if(S.activeSec===secId){S.activeSec=S.activePage=S.activeSub=null;clearEditor();} renderNotebooks();saveAll();renderTrash(); }
function pageDel(nbId,catId,secId,pageId,e){ e.stopPropagation(); if(!confirm('Supprimer cette page et ses notes ?'))return; const sec=S.notebooks.find(x=>x.id===nbId)?.cats.find(x=>x.id===catId)?.secs.find(x=>x.id===secId); const page=sec?.pages.find(x=>x.id===pageId); if(page)trashPush('page',page.name,JSON.parse(JSON.stringify(page)),{nbId,catId,secId}); if(sec)sec.pages=sec.pages.filter(x=>x.id!==pageId); if(S.activePage===pageId){S.activePage=S.activeSub=null;clearEditor();} renderNotebooks();saveAll();renderTrash(); }
function subDel(nbId,catId,secId,pageId,subId,e){ e.stopPropagation(); if(!confirm('Supprimer cette sous-page ?'))return; const page=S.notebooks.find(x=>x.id===nbId)?.cats.find(x=>x.id===catId)?.secs.find(x=>x.id===secId)?.pages.find(x=>x.id===pageId); const sub=page?.subpages.find(x=>x.id===subId); if(sub)trashPush('sous-page',sub.name,JSON.parse(JSON.stringify(sub)),{nbId,catId,secId,pageId}); if(page)page.subpages=page.subpages.filter(x=>x.id!==subId); if(S.activeSub===subId)S.activeSub=null; renderNotebooks();saveAll();renderTrash(); }

// ═══════════════════════════════════════════════════════
// NOTE KEY & EDITOR
// ═══════════════════════════════════════════════════════
function nKey() {
  // Section sans page active → clé dédiée (évite _pnull_sproot)
  if ((S.activeSec !== null && S.activeSec !== undefined) && !S.activePage) {
    return 'nb'+S.activeNB+'_cat'+S.activeCat+'_s'+S.activeSec+'_sec';
  }
  return 'nb'+S.activeNB+'_cat'+S.activeCat+'_s'+S.activeSec+'_p'+S.activePage+'_sp'+(S.activeSub??'root');
}

function canEdit() {
  if (S.activeSub  !== null && S.activeSub  !== undefined) return true;
  if (S.activePage !== null && S.activePage !== undefined) return true;
  if (S.activeSec  !== null && S.activeSec  !== undefined &&
      S.activePage === null) return true;
  return false;
}

async function loadNote() {
  if (!canEdit()) { clearEditor(); return; }

  // Unlock editor FIRST — avant tout travail async
  const title  = document.getElementById('note-title');
  const body   = document.getElementById('note-body');
  const editor = body?.closest('.note-editor');
  if (!title || !body) return;
  title.disabled       = false;
  body.contentEditable = 'true';
  body.spellcheck      = true;
  title.placeholder    = 'Titre de la note…';
  if (editor) editor.classList.remove('no-page');


  const k = nKey();
  const n = S.notes[k] || null;

  const nb   = S.notebooks.find(x=>x.id===S.activeNB);
  const cat  = nb?.cats.find(x=>x.id===S.activeCat);
  const sec  = cat?.secs.find(x=>x.id===S.activeSec);
  const page = sec?.pages.find(x=>x.id===S.activePage);
  const sub  = page?.subpages.find(x=>x.id===S.activeSub);
  const pageName = sub?.name || page?.name || sec?.name || '';

  title.value    = n?.title || pageName;
  body.innerHTML = n ? n.content : '';

  await resolveNoteImages(body);
  markSaved(); updatePath();
}

function clearEditor() {
  const title = document.getElementById('note-title');
  const body  = document.getElementById('note-body');
  if (!title || !body) return;
  title.value           = '';
  title.placeholder     = 'Sélectionnez une page…';
  title.disabled        = true;
  body.innerHTML        = '';
  body.contentEditable  = 'false';
  const sp = document.getElementById('note-sp');
  if (sp) sp.textContent = '';
  const editor = document.getElementById('note-body')?.closest('.note-editor');
  if (editor) editor.classList.add('no-page');
  markSaved();
}

function updatePath() {
  const nb   = S.notebooks.find(x=>x.id===S.activeNB);
  const cat  = nb?.cats.find(x=>x.id===S.activeCat);
  const sec  = cat?.secs.find(x=>x.id===S.activeSec);
  const page = sec?.pages.find(x=>x.id===S.activePage);
  const sub  = page?.subpages.find(x=>x.id===S.activeSub);
  const sp   = document.getElementById('note-sp');
  if (sp) sp.textContent = [nb?.name,cat?.name,sec?.name,page?.name,sub?.name].filter(Boolean).join(' › ');
}

let _nt, _st;
function schedSave() { clearTimeout(_st); _st = setTimeout(()=>saveAll(), 800); }

function onEdit() {
  if (!canEdit()) return;
  const k = nKey();
  const body  = document.getElementById('note-body');
  const clone = body.cloneNode(true);
  // Strip les blob: URLs avant sauvegarde (data-src les réhydrate au chargement)
  clone.querySelectorAll('img[data-src]').forEach(img => {
    if (img.src.startsWith('blob:')) img.src = '';
  });
  S.notes[k] = {
    title:   document.getElementById('note-title').value,
    content: clone.innerHTML,
  };
  markUnsaved();
  clearTimeout(_nt);
  _nt = setTimeout(() => saveNote(false), 4000);
}

async function saveNote(manual) {
  await saveAll();
  markSaved();
  if (manual) toast('💾 Note sauvegardée !');
}

function markSaved()   { const b=document.getElementById('note-bar'),l=document.getElementById('note-sl'); if(b)b.classList.remove('unsaved'); if(l)l.textContent='Sauvegardé'; setLed(false); }
function markUnsaved() { const b=document.getElementById('note-bar'),l=document.getElementById('note-sl'); if(b)b.classList.add('unsaved');    if(l)l.textContent='Non sauvegardé'; setLed(true); }

function ex(cmd, val) { document.execCommand(cmd, false, val||null); }

// Table
let _tv = false;
function showTblPopup(e) { const p=document.getElementById('tbl-popup'); if(_tv){hideTbl();return;} const r=e.target.getBoundingClientRect(); p.style.top=(r.bottom+6)+'px'; p.style.left=r.left+'px'; p.classList.add('on'); _tv=true; }
function hideTbl() { document.getElementById('tbl-popup').classList.remove('on'); _tv=false; }
function insertTable() {
  const cols = Math.max(1, Math.min(10, +document.getElementById('tbl-cols').value || 3));
  const rows = Math.max(1, Math.min(20, +document.getElementById('tbl-rows').value || 3));

  // Insertion DOM directe : execCommand('insertHTML') supprime les attributs contenteditable
  // sur les cellules dans Chromium (tableau non éditable)
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const hRow  = document.createElement('tr');
  for (let c = 0; c < cols; c++) {
    const th = document.createElement('th');
    th.textContent = 'Col ' + (c + 1);
    hRow.appendChild(th);
  }
  thead.appendChild(hRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (let r = 0; r < rows; r++) {
    const tr = document.createElement('tr');
    for (let c = 0; c < cols; c++) {
      const td = document.createElement('td');
      td.innerHTML = '<br>';
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  const body = document.getElementById('note-body');
  body.focus();

  const sel = window.getSelection();
  let inserted = false;
  if (sel && sel.rangeCount) {
    const range = sel.getRangeAt(0);
    // Remonte jusqu'au bloc direct enfant de note-body
    let anchor = range.commonAncestorContainer;
    while (anchor.parentNode && anchor.parentNode !== body) anchor = anchor.parentNode;
    if (anchor.parentNode === body) {
      anchor.insertAdjacentElement('afterend', table);
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      table.insertAdjacentElement('afterend', p);
      const first = table.querySelector('th, td');
      if (first) {
        const r2 = document.createRange();
        r2.setStart(first, 0); r2.collapse(true);
        sel.removeAllRanges(); sel.addRange(r2);
      }
      inserted = true;
    }
  }
  if (!inserted) {
    const p = document.createElement('p'); p.innerHTML = '<br>';
    body.appendChild(table); body.appendChild(p);
  }

  hideTbl(); onEdit();
}

function pickImg() { document.getElementById('img-input').click(); }

// Compression canvas (max 1920px, JPEG 85%) avant sauvegarde dans Lutility_SAV/images/
function compressImg(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1920;
      const scale = img.width > MAX ? MAX / img.width : 1;
      const w = Math.round(img.width  * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl); // fallback si erreur
    img.src = dataUrl;
  });
}

function onImgFile(inp) {
  const f = inp.files[0]; if (!f) return;
  const reader = new FileReader();
  reader.onload = async e => {
    const dataUrl = await compressImg(e.target.result);
    const relPath  = await saveImg(dataUrl);
    let src, dsrc;
    if (relPath) {
      const blobUrl = await readImgAsBlob(relPath);
      src  = blobUrl || dataUrl;
      dsrc = ` data-src="${relPath}"`;
      if (blobUrl) _imgBlobMap.set(blobUrl, relPath); // fallback suppression
    } else {
      src  = dataUrl; // fallback inline si dossier inaccessible

      dsrc = '';
    }
    document.getElementById('note-body').focus();
    document.execCommand('insertHTML', false,
      `<img src="${src}"${dsrc} alt="${h(f.name)}" style="max-width:100%"><p></p>`);
    onEdit();
  };
  reader.readAsDataURL(f); inp.value = '';
}

async function _insertImgDataUrl(dataUrl) {
  const relPath = await saveImg(dataUrl);
  let src, dsrc;
  if (relPath) {
    const blobUrl = await readImgAsBlob(relPath);
    src  = blobUrl || dataUrl;
    dsrc = ` data-src="${relPath}"`;
    if (blobUrl) _imgBlobMap.set(blobUrl, relPath);
  } else {
    src  = dataUrl;
    dsrc = '';
  }
  document.execCommand('insertHTML', false,
    `<img src="${src}"${dsrc} alt="image" style="max-width:100%"><p></p>`);
  onEdit();
}

function onPaste(e) {
  const items = e.clipboardData?.items; if (!items) return;

  for (const item of items) {
    if (!item.type.startsWith('image/')) continue;

    const file = item.getAsFile();
    if (file) {
      e.preventDefault();
      const reader = new FileReader();
      reader.onload = async ev => {
        const dataUrl = await compressImg(ev.target.result);
        await _insertImgDataUrl(dataUrl);
      };
      reader.readAsDataURL(file);
      return;
    }

    // Screenshot Windows (bitmap CF_DIB) — fallback via IPC Electron
    e.preventDefault();
    window.api.clipboardReadImage().then(async dataUrl => {
      if (!dataUrl) return;
      const compressed = await compressImg(dataUrl);
      await _insertImgDataUrl(compressed);
    }).catch(() => {});
    return;
  }
}

// ── Font & size ───────────────────────────────────────────
function setFont(font) {
  if (!font) return;
  document.execCommand('fontName', false, font);
  // fontName wraps in <font face=""> — applique aussi via span pour les polices modernes
  const sel = window.getSelection();
  if (sel && sel.rangeCount) {
    const range = sel.getRangeAt(0);
    if (!range.collapsed) {
      const span = document.createElement('span');
      span.style.fontFamily = font;
      try { range.surroundContents(span); } catch(e) {}
    }
  }
  document.getElementById('tb-font').value = '';
  onEdit();
}

function setSize(size) {
  if (!size) return;
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  if (range.collapsed) return;
  const span = document.createElement('span');
  span.style.fontSize = size;
  try { range.surroundContents(span); } catch(e) {}
  document.getElementById('tb-size').value = '';
  onEdit();
}

// ── Sélecteur de couleur flottant ─────────────────────────
const _TB_COLORS = [
  '#ffffff','#e2e8f0','#94a3b8','#64748b','#334155','#0f172a',
  '#ef4444','#f97316','#fbbf24','#22c55e','#00d4ff','#a855f7',
  '#dc2626','#ea580c','#d97706','#16a34a','#0284c7','#7c3aed',
  '#fca5a5','#fdba74','#fde68a','#86efac','#67e8f9','#d8b4fe',
];

function showColorPicker(type, anchor) {
  document.getElementById('tb-color-popup')?.remove();
  const popup = document.createElement('div');
  popup.id = 'tb-color-popup';
  popup.style.cssText = 'position:fixed;z-index:9000;background:var(--surf2);border:1px solid var(--bord2);border-radius:10px;padding:10px;display:grid;grid-template-columns:repeat(6,22px);gap:5px;box-shadow:0 8px 32px rgba(0,0,0,.7)';
  const r = anchor.getBoundingClientRect();
  popup.style.top  = (r.bottom + 6) + 'px';
  popup.style.left = r.left + 'px';

  // Bouton "pas de couleur"
  const clearBtn = document.createElement('button');
  clearBtn.title = type === 'fg' ? 'Couleur automatique' : 'Supprimer le surlignage';
  clearBtn.style.cssText = 'width:22px;height:22px;border-radius:4px;background:transparent;border:1px solid var(--bord2);cursor:pointer;font-size:10px;color:var(--dim);display:flex;align-items:center;justify-content:center;grid-column:span 6;width:100%;height:20px;border-radius:5px';
  clearBtn.textContent = '✕ Supprimer la couleur';
  clearBtn.style.cssText += ';font-size:10px;font-family:var(--mono);letter-spacing:.5px';
  clearBtn.onmousedown = e => {
    e.preventDefault();
    document.getElementById('note-body').focus();
    if (type === 'fg') document.execCommand('foreColor', false, 'inherit');
    else { document.execCommand('hiliteColor', false, 'transparent'); document.getElementById('tb-hl-bar').style.background = 'var(--bord2)'; }
    popup.remove(); onEdit();
  };
  popup.appendChild(clearBtn);

  _TB_COLORS.forEach(col => {
    const btn = document.createElement('button');
    btn.title = col;
    btn.style.cssText = `width:22px;height:22px;border-radius:4px;background:${col};border:2px solid rgba(255,255,255,.08);cursor:pointer;transition:transform .1s;flex-shrink:0`;
    btn.onmouseover = () => btn.style.transform = 'scale(1.25)';
    btn.onmouseout  = () => btn.style.transform = '';
    btn.onmousedown = e => {
      e.preventDefault();
      document.getElementById('note-body').focus();
      if (type === 'fg') {
        document.execCommand('foreColor', false, col);
        document.getElementById('tb-fg-bar').style.background = col;
      } else {
        document.execCommand('hiliteColor', false, col);
        document.getElementById('tb-hl-bar').style.background = col;
      }
      popup.remove(); onEdit();
    };
    popup.appendChild(btn);
  });

  document.body.appendChild(popup);
  setTimeout(() => {
    document.addEventListener('mousedown', function _close(e) {
      if (!popup.contains(e.target) && !e.target.closest('#tb-fg,#tb-hl')) {
        popup.remove();
        document.removeEventListener('mousedown', _close, true);
      }
    }, true);
  }, 0);
}

// ═══════════════════════════════════════════════════════
// CORBEILLE
// ═══════════════════════════════════════════════════════
function renderTrash() {
  const c = document.getElementById('nb-list');
  if (!c) return;

  const existing = document.getElementById('trash-section');
  if (existing) existing.remove();

  if (!S.trash || !S.trash.length) return;

  const section = document.createElement('div');
  section.id = 'trash-section';
  section.style.cssText = 'margin-top:16px;border-top:1px solid var(--bord);padding-top:8px';

  const hdr = document.createElement('div');
  hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 12px 4px;cursor:pointer;user-select:none';
  hdr.innerHTML =
    '<span style="font-family:var(--mono);font-size:9px;color:var(--dim);letter-spacing:2px;text-transform:uppercase">🗑 Corbeille (' + S.trash.length + ')</span>' +
    '<span id="trash-toggle" style="font-size:10px;color:var(--dim)">▾</span>';

  const list = document.createElement('div');
  list.id = 'trash-list';

  let _open = false;
  hdr.onclick = () => {
    _open = !_open;
    list.style.display = _open ? 'block' : 'none';
    document.getElementById('trash-toggle').textContent = _open ? '▴' : '▾';
  };
  section.appendChild(hdr);

  S.trash.forEach((item, idx) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:7px 12px;font-size:12px;color:var(--dim2);border-top:1px solid rgba(28,36,54,.3);transition:background .1s';
    row.onmouseover = () => row.style.background = 'rgba(255,255,255,.02)';
    row.onmouseout  = () => row.style.background = '';

    const typeIco = { 'carnet':'📓', 'catégorie':'📂', 'section':'📁', 'page':'📄', 'sous-page':'↳' };
    row.innerHTML =
      '<span style="flex-shrink:0;font-size:11px">' + (typeIco[item.type]||'📄') + '</span>' +
      '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + h(item.name) + '</span>' +
      '<span style="font-family:var(--mono);font-size:9px;color:var(--dim);flex-shrink:0">' + item.date + '</span>' +
      '<button onclick="trashRestore(' + idx + ')" style="flex-shrink:0;padding:2px 7px;border-radius:4px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.25);color:var(--green);font-size:9px;cursor:pointer;font-family:var(--mono);letter-spacing:.5px" title="Restaurer">↩</button>' +
      '<button onclick="trashDelete(' + idx + ')" style="flex-shrink:0;width:16px;height:16px;border-radius:3px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);color:var(--red);font-size:9px;cursor:pointer;display:flex;align-items:center;justify-content:center" title="Supprimer définitivement">✕</button>';
    list.appendChild(row);
  });

  list.style.display = 'none';
  section.appendChild(list);

  // Clear all button
  const clearBtn = document.createElement('div');
  clearBtn.style.cssText = 'padding:6px 12px;font-family:var(--mono);font-size:9px;color:var(--dim);cursor:pointer;letter-spacing:1px;text-align:right;transition:color .12s';
  clearBtn.textContent = 'Vider la corbeille';
  clearBtn.onmouseover = () => clearBtn.style.color = 'var(--red)';
  clearBtn.onmouseout  = () => clearBtn.style.color = 'var(--dim)';
  clearBtn.onclick = () => {
    if (!confirm('Vider définitivement la corbeille ?')) return;
    S.trash = []; saveAll(); renderTrash(); _refocusEditor();
  };
  section.appendChild(clearBtn);

  c.appendChild(section);
}

function trashRestore(idx) {
  const item = S.trash[idx];
  if (!item) return;
  const p = item.parentPath;

  try {
    if (item.type === 'carnet') {
      S.notebooks.push(item.data);
    } else if (item.type === 'catégorie') {
      const nb = S.notebooks.find(x => x.id === p.nbId);
      if (nb) nb.cats.push(item.data);
    } else if (item.type === 'section') {
      const cat = S.notebooks.find(x=>x.id===p.nbId)?.cats.find(x=>x.id===p.catId);
      if (cat) cat.secs.push(item.data);
    } else if (item.type === 'page') {
      const sec = S.notebooks.find(x=>x.id===p.nbId)?.cats.find(x=>x.id===p.catId)?.secs.find(x=>x.id===p.secId);
      if (sec) sec.pages.push(item.data);
    } else if (item.type === 'sous-page') {
      const page = S.notebooks.find(x=>x.id===p.nbId)?.cats.find(x=>x.id===p.catId)?.secs.find(x=>x.id===p.secId)?.pages.find(x=>x.id===p.pageId);
      if (page) page.subpages.push(item.data);
    }
    S.trash.splice(idx, 1);
    toast('↩ ' + item.name + ' restauré !');
  } catch(e) {
    toast('⚠ Impossible de restaurer — parent introuvable', 'warn');
    S.trash.splice(idx, 1);
  }
  renderNotebooks(); saveAll(); renderTrash();
}

function trashDelete(idx) {
  S.trash.splice(idx, 1);
  saveAll(); renderTrash();
  _refocusEditor();
}

function _refocusEditor() {
  if (!S.activePage) return;
  setTimeout(() => document.getElementById('note-body')?.focus(), 50);
}

// ═══════════════════════════════════════════════════════
// IMAGE TOOLBAR — clic sur image → barre ↑ ↓ ✕
// ═══════════════════════════════════════════════════════
let _selImg = null;

function _showImgBar(img) {
  _removeImgBar();
  img.classList.add('img-selected');
  _selImg = img;

  const bar = document.createElement('div');
  bar.id = 'img-bar';
  bar.style.cssText = 'position:fixed;z-index:6000;background:var(--surf2);border:1px solid var(--bord2);border-radius:8px;display:flex;gap:3px;padding:5px;box-shadow:0 4px 20px rgba(0,0,0,.6);align-items:center';

  const mkBtn = (txt, danger, cb) => {
    const b = document.createElement('button');
    b.className = 'btn xs';
    b.textContent = txt;
    if (danger) b.style.cssText = 'color:var(--red);border-color:rgba(239,68,68,.3)';
    b.onmousedown = e => { e.preventDefault(); cb(); };
    return b;
  };

  bar.appendChild(mkBtn('↑ Monter',    false, () => _moveImg(img, -1)));
  bar.appendChild(mkBtn('↓ Descendre', false, () => _moveImg(img,  1)));
  bar.appendChild(mkBtn('✕ Supprimer', true,  () => _deleteImg(img)));
  document.body.appendChild(bar);
  _posImgBar(img);
}

function _posImgBar(img) {
  const bar = document.getElementById('img-bar');
  if (!bar || !img) return;
  const r  = img.getBoundingClientRect();
  const bh = bar.offsetHeight || 36;
  bar.style.left = Math.max(4, r.left) + 'px';
  bar.style.top  = Math.max(4, r.top - bh - 6) + 'px';
}

function _removeImgBar() {
  _selImg = null;
  document.querySelectorAll('.note-body img').forEach(i => i.classList.remove('img-selected'));
  document.getElementById('img-bar')?.remove();
}

async function _deleteImg(img) {
  // data-src peut être absent dans les cellules de tableau (Chromium le strip parfois)
  // → on utilise _imgBlobMap comme fallback (blobUrl → relPath)
  const relPath = img.dataset.src || _imgBlobMap.get(img.src);
  if (relPath && savPath) await window.api.fileDelete(savPath, relPath);
  if (img.src) _imgBlobMap.delete(img.src);
  img.remove();
  _removeImgBar();
  onEdit();
}

function _moveImg(img, dir) {
  const body = document.getElementById('note-body');
  if (!body) return;

  // Si l'image est dans une cellule de tableau, la déplace dans la cellule
  const tdParent = img.closest('td, th');
  if (tdParent) {
    if (dir === -1) {
      const prev = img.previousElementSibling;
      if (prev) tdParent.insertBefore(img, prev);
    } else {
      const next = img.nextElementSibling;
      if (next) next.insertAdjacentElement('afterend', img);
    }
  } else {
    // Remonte au bloc direct enfant de note-body (ex: <p> contenant l'image)
    let block = img;
    while (block.parentElement && block.parentElement !== body) block = block.parentElement;
    if (dir === -1) {
      const prev = block.previousElementSibling;
      if (prev) body.insertBefore(block, prev);
    } else {
      const next = block.nextElementSibling;
      if (next) next.insertAdjacentElement('afterend', block);
    }
  }
  _posImgBar(img);
  onEdit();
}

async function _copyImg(img, cut) {
  try {
    // Récupère le blob de l'image (blob URL ou data URL)
    const src = img.src;
    let blob;
    if (src.startsWith('blob:') || src.startsWith('data:')) {
      const resp = await fetch(src);
      blob = await resp.blob();
    } else if (img.dataset.src) {
      const b64 = await window.api.fileReadBinary(S.savePath, img.dataset.src);
      if (b64) {
        const bytes = atob(b64);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        blob = new Blob([arr], { type: 'image/jpeg' });
      }
    }
    if (blob) {
      // Convertit en PNG pour compatibilité presse-papiers
      const bmp = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width; canvas.height = bmp.height;
      canvas.getContext('2d').drawImage(bmp, 0, 0);
      const pngBlob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
      if (cut) { _deleteImg(img); toast('✂️ Image coupée — collez avec Ctrl+V'); }
      else      { _removeImgBar(); toast('📋 Image copiée — collez avec Ctrl+V'); }
      return;
    }
  } catch(e) { console.warn('_copyImg clipboard API:', e); }
  // Fallback : sélection DOM
  const range = document.createRange();
  range.selectNode(img);
  const sel = window.getSelection();
  sel.removeAllRanges(); sel.addRange(range);
  document.execCommand('copy');
  sel.removeAllRanges();
  if (cut) { _deleteImg(img); toast('✂️ Image coupée — collez avec Ctrl+V'); }
  else      { _removeImgBar(); toast('📋 Image copiée — collez avec Ctrl+V'); }
}

// ── Gestion colonnes/lignes du tableau ────────────────
function _tblCellMenu(e, cell) {
  e.preventDefault(); e.stopPropagation();
  const tr    = cell.closest('tr');
  const tbody = cell.closest('tbody, thead, table');
  const table = cell.closest('table');
  if (!tr || !table) return;

  showCtx(e, [
    { label: 'Lignes' },
    { ico:'＋', text:'Ligne au-dessus',  action: () => { const nr=tr.cloneNode(true);nr.querySelectorAll('td,th').forEach(c=>c.innerHTML='<br>');tr.parentElement.insertBefore(nr,tr);onEdit(); } },
    { ico:'＋', text:'Ligne en-dessous', action: () => { const nr=tr.cloneNode(true);nr.querySelectorAll('td,th').forEach(c=>c.innerHTML='<br>');tr.insertAdjacentElement('afterend',nr);onEdit(); } },
    { ico:'−', text:'Supprimer la ligne', action: () => { if(table.rows.length>1){tr.remove();onEdit();}else toast('Impossible — dernière ligne','warn'); } },
    'sep',
    { label: 'Colonnes' },
    { ico:'＋', text:'Colonne à gauche',  action: () => {
      const ci=Array.from(tr.cells).indexOf(cell);
      Array.from(table.rows).forEach(r=>{const nc=document.createElement(r.rowIndex===0?'th':'td');nc.innerHTML='<br>';r.cells[ci]?.insertAdjacentElement('beforebegin',nc);});onEdit();
    }},
    { ico:'＋', text:'Colonne à droite',  action: () => {
      const ci=Array.from(tr.cells).indexOf(cell);
      Array.from(table.rows).forEach(r=>{const nc=document.createElement(r.rowIndex===0?'th':'td');nc.innerHTML='<br>';r.cells[ci]?.insertAdjacentElement('afterend',nc);});onEdit();
    }},
    { ico:'−', text:'Supprimer la colonne', action: () => {
      const ci=Array.from(tr.cells).indexOf(cell);
      if(tr.cells.length>1){Array.from(table.rows).forEach(r=>{r.cells[ci]?.remove();});onEdit();}
      else toast('Impossible — dernière colonne','warn');
    }},
    'sep',
    { ico:'🗑️', text:'Supprimer le tableau', danger: true, action: () => { if(confirm('Supprimer ce tableau ?')){table.remove();onEdit();} } },
  ]);
}

// ── Init : attache les événements sur note-body ────────
(function _initImgEvents() {
  const body = document.getElementById('note-body');
  if (!body) return;
  body.addEventListener('click', e => {
    if (e.target.tagName === 'IMG') _showImgBar(e.target);
    else _removeImgBar();
  });
  body.addEventListener('contextmenu', e => {
    const cell = e.target.closest('td, th');
    if (cell && cell.closest('table')) { _tblCellMenu(e, cell); return; }
  });


  // Navigation Tab dans les tableaux
  body.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const cell = e.target.closest ? e.target.closest('td, th') : null;
    if (!cell) return;
    e.preventDefault();
    const table = cell.closest('table');
    if (!table) return;
    const allCells = Array.from(table.querySelectorAll('th, td'));
    const idx = allCells.indexOf(cell);
    const next = e.shiftKey ? allCells[idx - 1] : allCells[idx + 1];
    if (next) {
      next.focus();
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(next);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  });
  // Ferme la barre si clic hors de la zone
  document.addEventListener('mousedown', e => {
    if (!e.target.closest('#img-bar') && e.target.tagName !== 'IMG') _removeImgBar();
  }, true);
})();
