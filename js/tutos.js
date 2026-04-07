// ══ TUTORIELS ════════════════════════════════════════════
let _tutos      = [];
let _tutoCat    = 'all';
let _tutoGame   = 'all';
let _tutoSearch = '';
let _openTutoId = null;

async function loadTutos() {
  try {
    _tutos = await window.api.readTutorials();
    if (!Array.isArray(_tutos)) _tutos = [];
  } catch { _tutos = []; }
  _renderTutoCounts();
  _renderGameFilter();
  renderTutos();
}

function _renderTutoCounts() {
  const cats = ['windows','gaming','programme','autres'];
  const el = id => document.getElementById('tc-' + id);
  if (el('all')) el('all').textContent = _tutos.length;
  cats.forEach(c => {
    const n = _tutos.filter(t => t.category === c).length;
    if (el(c)) el(c).textContent = n || '';
  });
}

function _renderGameFilter() {
  const wrap = document.getElementById('tutos-games');
  if (!wrap) return;
  if (_tutoCat !== 'gaming') { wrap.innerHTML = ''; return; }

  const games = [...new Set(
    _tutos.filter(t => t.category === 'gaming' && t.game).map(t => t.game)
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
  const filtered = _tutos.filter(t => {
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
  list.innerHTML = filtered.map(t => `
    <div class="tuto-card ${_openTutoId === t.id ? 'on' : ''}" onclick="openTuto(${t.id})">
      <div class="tuto-card-ico">${_catIco(t.category)}</div>
      <div class="tuto-card-body">
        <div class="tuto-card-title">${escHtml(t.title)}</div>
        <div class="tuto-card-desc">${escHtml(t.description)}</div>
        <div class="tuto-card-meta">
          <span class="tuto-cat-tag tuto-cat-${t.category}">${_catLabel(t.category)}</span>
          ${t.game ? `<span class="tuto-game-tag">${escHtml(t.game)}</span>` : ''}
          <span class="tuto-steps-count">${t.steps?.length || 0} étape${(t.steps?.length||0)>1?'s':''}</span>
          ${t.date ? `<span class="tuto-date">${_fmtTutoDate(t.date)}</span>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

function openTuto(id) {
  _openTutoId = id;
  renderTutos();
  const t = _tutos.find(x => x.id === id);
  const panel = document.getElementById('tutos-panel');
  if (!t || !panel) return;
  panel.innerHTML = `
    <div class="tutos-panel-content">
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
              ${s.image ? `<img class="tuto-step-img" src="tutorials-img/${escHtml(s.image)}" loading="lazy" alt="">` : ''}
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
