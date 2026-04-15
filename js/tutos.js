// ══ TUTORIELS ════════════════════════════════════════════
let _tutos      = [];
let _userTutos  = [];
let _tutoCat    = 'all';
let _tutoGame   = 'all';
let _tutoSearch = '';
let _openTutoId = null;

function _allTutos() { return [..._tutos, ..._userTutos]; }

async function loadTutos() {
  try {
    _tutos = await window.api.readTutorials();
    if (!Array.isArray(_tutos)) _tutos = [];
  } catch { _tutos = []; }
  if (savPath) {
    try {
      _userTutos = await window.api.readUserTutorials(savPath);
      if (!Array.isArray(_userTutos)) _userTutos = [];
    } catch { _userTutos = []; }
  }
  _renderTutoCounts();
  _renderGameFilter();
  renderTutos();
  if (!_openTutoId) _renderTutoSummary();
}

function _renderTutoCounts() {
  const cats = ['windows','gaming','programme','autres'];
  const el = id => document.getElementById('tc-' + id);
  const all = _allTutos();
  if (el('all')) el('all').textContent = all.length;
  cats.forEach(c => {
    const n = all.filter(t => t.category === c).length;
    if (el(c)) el(c).textContent = n || '';
  });
}

function _renderGameFilter() {
  const wrap = document.getElementById('tutos-games');
  if (!wrap) return;
  if (_tutoCat !== 'gaming') { wrap.innerHTML = ''; return; }

  const games = [...new Set(
    _allTutos().filter(t => t.category === 'gaming' && t.game).map(t => t.game)
  )];
  if (!games.length) { wrap.innerHTML = ''; return; }

  wrap.innerHTML = [
    `<button class="tuto-game-btn${_tutoGame==='all'?' on':''}" onclick="setTutoGame('all')">Tous</button>`,
    ...games.map(g =>
      `<button class="tuto-game-btn${_tutoGame===g?' on':''}" onclick="setTutoGame(${JSON.stringify(g)})">${escHtml(g)}</button>`
    )
  ].join('');
}

function setTutoCat(cat) {
  _tutoCat = cat;
  _tutoGame = 'all';
  document.querySelectorAll('.tuto-cat-btn').forEach(b => b.classList.toggle('on', b.dataset.cat === cat));
  _renderGameFilter();
  renderTutos();
}

function setTutoGame(game) {
  _tutoGame = game;
  _renderGameFilter();
  renderTutos();
}

function filterTutos() {
  _tutoSearch = document.getElementById('tutos-search')?.value?.toLowerCase() || '';
  renderTutos();
}

function renderTutos() {
  const list = document.getElementById('tutos-list');
  if (!list) return;
  const filtered = _allTutos().filter(t => {
    const matchCat    = _tutoCat === 'all' || t.category === _tutoCat;
    const matchGame   = _tutoCat !== 'gaming' || _tutoGame === 'all' || t.game === _tutoGame;
    const matchSearch = !_tutoSearch
      || t.title.toLowerCase().includes(_tutoSearch)
      || (t.description||'').toLowerCase().includes(_tutoSearch)
      || (t.game||'').toLowerCase().includes(_tutoSearch);
    return matchCat && matchGame && matchSearch;
  });
  if (!filtered.length) {
    list.innerHTML = '<div class="tutos-empty">Aucun tutoriel trouvé.</div>';
    return;
  }
  list.innerHTML = filtered.map(t => {
    const isUser = _userTutos.some(u => u.id === t.id);
    return `
    <div class="tuto-card ${_openTutoId === t.id ? 'on' : ''}" onclick="openTuto(${t.id})">
      <div class="tuto-card-ico">${_catIco(t.category)}</div>
      <div class="tuto-card-body">
        <div class="tuto-card-title">${escHtml(t.title)}${isUser ? ' <span style="font-size:9px;background:rgba(168,85,247,.15);color:var(--purple);border-radius:3px;padding:1px 5px;font-family:var(--mono);letter-spacing:.5px">perso</span>' : ''}</div>
        <div class="tuto-card-desc">${escHtml(t.description)}</div>
        <div class="tuto-card-meta">
          <span class="tuto-cat-tag tuto-cat-${t.category}">${_catLabel(t.category)}</span>
          ${t.game ? `<span class="tuto-game-tag">${escHtml(t.game)}</span>` : ''}
          <span class="tuto-steps-count">${t.steps?.length || 0} étape${(t.steps?.length||0)>1?'s':''}</span>
          ${t.date ? `<span class="tuto-date">${_fmtTutoDate(t.date)}</span>` : ''}
          ${(isUser || window.api.isDev) ? `<button class="btn sm" style="padding:1px 7px;font-size:10px;margin-left:auto" onclick="event.stopPropagation();teOpen(${t.id})">✏️</button>` : ''}${isUser && window.api.isDev ? `<button class="btn sm" style="padding:1px 7px;font-size:10px" title="Publier dans tutorials.json" onclick="event.stopPropagation();tePublish(${t.id})">📤</button>` : ''}${(isUser || window.api.isDev) ? `<button class="btn sm sc-del" style="padding:1px 7px;font-size:10px" onclick="event.stopPropagation();teDelete(${t.id})">✕</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function _renderTutoSummary() {
  const panel = document.getElementById('tutos-panel');
  if (!panel) return;
  const all = _allTutos();
  if (!all.length) {
    panel.innerHTML = `<div class="tutos-panel-empty"><span class="tutos-panel-ico">📖</span><div>Aucun tutoriel disponible</div></div>`;
    return;
  }
  // Regrouper par date YYYY-MM
  const groups = {};
  for (const t of all) {
    const key = t.date || '0000-00';
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }
  const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
  const html = sortedKeys.map(key => {
    const label = key === '0000-00' ? 'Sans date' : _fmtTutoDate(key);
    const items = groups[key];
    return `<div class="tutos-sum-group">
      <div class="tutos-sum-date">${label}<span class="tutos-sum-count">${items.length}</span></div>
      ${items.map(t => `<div class="tutos-sum-item" onclick="openTuto(${t.id})">
        <span class="tutos-sum-ico">${_catIco(t.category)}</span>
        <span class="tutos-sum-name">${escHtml(t.title)}</span>
      </div>`).join('')}
    </div>`;
  }).join('');
  panel.innerHTML = `<div class="tutos-summary"><div class="tutos-sum-hdr">Sommaire</div>${html}</div>`;
}

function closeTuto() {
  _openTutoId = null;
  renderTutos();
  _renderTutoSummary();
}

function openTuto(id) {
  // Toggle : cliquer sur le tuto déjà ouvert revient au sommaire
  if (_openTutoId === id) {
    closeTuto();
    return;
  }
  _openTutoId = id;
  renderTutos();
  const t = _allTutos().find(x => x.id === id);
  const panel = document.getElementById('tutos-panel');
  if (!t || !panel) return;
  panel.innerHTML = `
    <div class="tutos-panel-content">
      <button class="tutos-back-btn" onclick="closeTuto()">← Sommaire</button>
      <div class="tutos-panel-hdr">
        <div class="tutos-panel-tags">
          <span class="tuto-cat-tag tuto-cat-${t.category}">${_catLabel(t.category)}</span>
          ${t.game ? `<span class="tuto-game-tag">${escHtml(t.game)}</span>` : ''}
          ${t.date ? `<span class="tuto-date tuto-date-panel">${_fmtTutoDate(t.date)}</span>` : ''}
        </div>
        <h2 class="tutos-panel-title">${escHtml(t.title)}</h2>
        <p class="tutos-panel-desc">${escHtml(t.description)}</p>
      </div>
      <div class="tutos-steps">
        ${(t.steps||[]).map((s,i) => `
          <div class="tuto-step">
            <div class="tuto-step-num">${i+1}</div>
            <div class="tuto-step-body">
              <div class="tuto-step-text">${_fmtText(s.text)}</div>
              ${s.note ? `<div class="tuto-step-note">${_fmtText(s.note)}</div>` : ''}
              ${s.image ? `<img class="tuto-step-img" src="${s.image.startsWith('file://') ? s.image : 'tutorials-img/' + escHtml(s.image)}" loading="lazy" alt=""${s.imageWidth && s.imageWidth !== 100 ? ` style="width:${s.imageWidth}%"` : ''}>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Formate YYYY-MM en "Mois ANNÉE"
function _fmtTutoDate(str) {
  try {
    const [y, m] = str.split('-');
    return new Date(+y, +m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  } catch { return str; }
}

// Formate le texte : **gras** et sauts de ligne
function _fmtText(text) {
  if (!text) return '';
  const parts = text.split('**');
  return parts.map((p, i) => {
    const escaped = escHtml(p).replace(/\n/g, '<br>');
    return i % 2 === 1 ? `<strong>${escaped}</strong>` : escaped;
  }).join('');
}

function _catIco(cat) {
  return { windows:'🪟', gaming:'🎮', programme:'📦', autres:'📂' }[cat] || '📖';
}
function _catLabel(cat) {
  return { windows:'Windows', gaming:'Gaming', programme:'Programme', autres:'Autres' }[cat] || cat;
}

// ══ ÉDITEUR TUTORIELS IN-APP ═════════════════════════════
let _teEditId  = null;
let _teSteps   = [];  // [{text, note, image}]

function teToggleGame() {
  const cat = document.getElementById('te-cat')?.value;
  const row = document.getElementById('te-game-row');
  if (row) row.style.display = cat === 'gaming' ? 'block' : 'none';
}

function teOpen(id) {
  _teEditId = id;
  _teSteps  = [];
  const modal = document.getElementById('modal-tuto-edit');
  if (!modal) return;

  if (id !== null) {
    // Édition — cherche dans tous les tutos (perso + officiels en dev)
    const t = _allTutos().find(u => u.id === id);
    if (!t) return;
    document.getElementById('tuto-edit-title').textContent = '✏️ Modifier le tutoriel';
    document.getElementById('te-title').value = t.title || '';
    document.getElementById('te-cat').value   = t.category || 'autres';
    document.getElementById('te-desc').value  = t.description || '';
    document.getElementById('te-game').value  = t.game || '';
    _teSteps = (t.steps || []).map(s => ({ ...s }));
  } else {
    // Nouveau
    document.getElementById('tuto-edit-title').textContent = '✏️ Nouveau tutoriel';
    document.getElementById('te-title').value = '';
    document.getElementById('te-cat').value   = 'windows';
    document.getElementById('te-desc').value  = '';
    document.getElementById('te-game').value  = '';
    _teSteps = [{ text: '', note: '', image: '' }];
  }
  teToggleGame();
  _teRenderSteps();
  openModal('modal-tuto-edit');
}

function _teMakeStepCard(s, i) {
  const card = document.createElement('div');
  card.style.cssText = 'border:1px solid var(--bord2);border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:8px;background:var(--bg3)';

  // ── En-tête : numéro + boutons ordre/suppression ──
  const hdr = document.createElement('div');
  hdr.style.cssText = 'display:flex;align-items:center;gap:8px';

  const lbl = document.createElement('span');
  lbl.style.cssText = 'font-family:var(--mono);font-size:11px;color:var(--dim)';
  lbl.textContent = 'Étape ' + (i + 1);
  hdr.appendChild(lbl);

  const del = document.createElement('button');
  del.className = 'btn sm sc-del';
  del.style.cssText = 'padding:1px 7px;font-size:10px;margin-left:auto';
  del.title = 'Supprimer l\'étape';
  del.textContent = '✕';
  del.addEventListener('click', () => { _teSteps.splice(i, 1); _teRenderSteps(); });
  hdr.appendChild(del);

  if (i > 0) {
    const up = document.createElement('button');
    up.className = 'btn sm'; up.style.cssText = 'padding:1px 7px;font-size:10px'; up.title = 'Monter'; up.textContent = '↑';
    up.addEventListener('click', () => { [_teSteps[i], _teSteps[i-1]] = [_teSteps[i-1], _teSteps[i]]; _teRenderSteps(); });
    hdr.appendChild(up);
  }
  if (i < _teSteps.length - 1) {
    const dn = document.createElement('button');
    dn.className = 'btn sm'; dn.style.cssText = 'padding:1px 7px;font-size:10px'; dn.title = 'Descendre'; dn.textContent = '↓';
    dn.addEventListener('click', () => { [_teSteps[i], _teSteps[i+1]] = [_teSteps[i+1], _teSteps[i]]; _teRenderSteps(); });
    hdr.appendChild(dn);
  }
  card.appendChild(hdr);

  // ── Texte de l'étape ──
  const ta = document.createElement('textarea');
  ta.className = 'fin'; ta.style.cssText = 'min-height:60px;resize:vertical;font-size:12px';
  ta.placeholder = 'Texte de l\'étape… (**gras** supporté)';
  ta.value = s.text || '';
  ta.addEventListener('input', () => { _teSteps[i].text = ta.value; });
  card.appendChild(ta);

  // ── Note optionnelle ──
  const note = document.createElement('input');
  note.className = 'fin'; note.style.fontSize = '11px';
  note.placeholder = 'Note (optionnel)…';
  note.value = s.note || '';
  note.addEventListener('input', () => { _teSteps[i].note = note.value; });
  card.appendChild(note);

  // ── Image ──
  const imgRow = document.createElement('div');
  imgRow.style.cssText = 'display:flex;align-items:center;gap:8px';

  const imgLbl = document.createElement('div');
  imgLbl.className = 'fin';
  imgLbl.style.cssText = 'flex:1;font-size:11px;color:var(--dim2);font-family:var(--mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  imgLbl.title = s.image || '';
  imgLbl.textContent = s.image ? s.image.split(/[/\\]/).pop() : '— Aucune image';
  imgRow.appendChild(imgLbl);

  const imgBtn = document.createElement('button');
  imgBtn.className = 'btn sm'; imgBtn.style.cssText = 'padding:2px 9px;font-size:11px;flex-shrink:0';
  imgBtn.textContent = '🖼 Image';
  imgBtn.addEventListener('click', () => _tePickImage(i));
  imgRow.appendChild(imgBtn);

  if (s.image) {
    const sizeSelect = document.createElement('select');
    sizeSelect.className = 'fin';
    sizeSelect.style.cssText = 'width:68px;font-size:11px;flex-shrink:0;padding:2px 4px';
    sizeSelect.title = 'Taille de l\'image';
    [[25,'25%'],[50,'50%'],[75,'75%'],[100,'100%']].forEach(([val, lbl]) => {
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = lbl;
      if ((s.imageWidth || 100) === val) opt.selected = true;
      sizeSelect.appendChild(opt);
    });
    sizeSelect.addEventListener('change', () => { _teSteps[i].imageWidth = +sizeSelect.value; });
    imgRow.appendChild(sizeSelect);

    const clr = document.createElement('button');
    clr.className = 'btn sm sc-del'; clr.style.cssText = 'padding:2px 7px;font-size:10px;flex-shrink:0'; clr.title = 'Retirer l\'image'; clr.textContent = '✕';
    clr.addEventListener('click', () => { _teSteps[i].image = ''; delete _teSteps[i].imageWidth; _teRenderSteps(); });
    imgRow.appendChild(clr);
  }
  card.appendChild(imgRow);
  return card;
}

function _teRenderSteps() {
  const wrap = document.getElementById('te-steps');
  if (!wrap) return;
  wrap.innerHTML = '';
  _teSteps.forEach((s, i) => wrap.appendChild(_teMakeStepCard(s, i)));
}

async function _tePickImage(i) {
  if (!savPath) { toast('Dossier SAV requis', 'warn'); return; }
  const p = await window.api.chooseImage();
  if (!p) return;
  const ext = p.split('.').pop().toLowerCase();
  const filename = `tuto_${Date.now()}.${ext}`;
  const b64 = await window.api.readFileBase64(p);
  if (!b64) { toast('Impossible de lire l\'image', 'warn'); return; }
  const r = await window.api.saveTutoImage(savPath, b64, filename);
  if (!r.ok) { toast('Erreur copie image', 'warn'); return; }
  _teSteps[i].image = 'file:///' + r.path.replace(/\\/g, '/');
  _teRenderSteps();
}

function teAddStep() {
  _teSteps.push({ text: '', note: '', image: '' });
  _teRenderSteps();
  setTimeout(() => {
    document.getElementById('te-steps')?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 50);
}

function _teBuildValidated() {
  const titleEl = document.getElementById('te-title');
  const title = titleEl.value.trim();
  if (!title) { toast('Titre requis', 'warn'); titleEl.focus(); return null; }
  const steps = _teSteps.filter(s => s.text.trim()).map(s => ({
    text: s.text.trim(),
    ...(s.note?.trim() ? { note: s.note.trim() } : {}),
    ...(s.image        ? { image: s.image, ...(s.imageWidth && s.imageWidth !== 100 ? { imageWidth: s.imageWidth } : {}) } : {}),
  }));
  if (!steps.length) { toast('Ajoutez au moins une étape', 'warn'); return null; }
  const cat  = document.getElementById('te-cat').value;
  const game = document.getElementById('te-game').value.trim();
  return {
    id:          _teEditId !== null ? _teEditId : Date.now(),
    title,
    category:    cat,
    description: document.getElementById('te-desc').value.trim(),
    steps,
    date:        new Date().toISOString().slice(0, 7),
    ...(cat === 'gaming' && game ? { game } : {}),
  };
}

async function teSave() {
  const tuto = _teBuildValidated();
  if (!tuto) return;
  const isOfficial = _teEditId !== null && _tutos.some(t => t.id === _teEditId);
  if (!isOfficial && !savPath) { toast('Dossier SAV requis', 'warn'); return; }
  const r = isOfficial
    ? await window.api.saveOfficialTutorial(tuto)
    : await window.api.saveUserTutorial(savPath, tuto);
  if (!r.ok) { toast('Erreur sauvegarde : ' + (r.err || '?'), 'warn'); return; }
  closeModal('modal-tuto-edit');
  toast(_teEditId !== null ? '✅ Tutoriel modifié !' : '✅ Tutoriel ajouté !');
  await loadTutos();
  openTuto(tuto.id);
}

async function tePublish(id) {
  const t = _userTutos.find(u => u.id === id);
  if (!t) return;
  if (!confirm(`Publier "${t.title}" dans tutorials.json ?`)) return;
  const r = await window.api.publishTutorial(t);
  if (!r.ok) { toast('Erreur publication : ' + (r.err || '?'), 'warn'); return; }
  let msg = `✅ Publié (id ${r.id}) — git push pour diffuser`;
  if (r.copiedImages)  msg += ` · 🖼️ ${r.copiedImages} image(s) copiée(s) dans tutorials-img/`;
  if (r.failedImages)  msg += ` · ⚠️ ${r.failedImages} image(s) introuvable(s)`;
  toast(msg);
  await loadTutos();
}

async function teDelete(id) {
  if (!confirm('Supprimer ce tutoriel ?')) return;
  const isOfficial = _tutos.some(t => t.id === id);
  if (isOfficial) {
    const r = await window.api.deleteOfficialTutorial(id);
    if (!r.ok) { toast('Erreur suppression : ' + (r.err || '?'), 'warn'); return; }
  } else {
    if (!savPath) return;
    await window.api.deleteUserTutorial(savPath, id);
  }
  if (_openTutoId === id) {
    _openTutoId = null;
    const panel = document.getElementById('tutos-panel');
    if (panel) panel.innerHTML = '<div class="tutos-panel-empty"><span class="tutos-panel-ico">📖</span><div>Sélectionnez un tutoriel</div></div>';
  }
  toast('Tutoriel supprimé');
  await loadTutos();
}
