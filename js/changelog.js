// ── Changelog / Patch Notes ───────────────────────────
let _clData = null;

async function loadChangelog() {
  if (_clData) { _renderChangelog(); return; }
  try {
    const res = await fetch('changelog.json?t=' + Date.now());
    _clData = await res.json();
  } catch {
    _clData = [];
  }
  _renderChangelog();
}

function _renderChangelog() {
  const wrap = document.getElementById('cl-list');
  if (!wrap) return;

  if (!_clData || !_clData.length) {
    wrap.innerHTML = '<div class="cl-empty">Aucune entrée de changelog disponible.</div>';
    return;
  }

  wrap.innerHTML = _clData.map((entry, i) => {
    const isFeat = entry.type === 'feat';
    const badge  = isFeat
      ? '<span class="cl-badge feat">🆕 Nouveauté</span>'
      : '<span class="cl-badge fix">🔧 Correctif</span>';
    const current = i === 0 ? '<span class="cl-current">VERSION ACTUELLE</span>' : '';
    const dateStr = _fmtDate(entry.date);

    const items = (entry.changes || [])
      .map(c => `<li class="cl-item">${escHtml(c)}</li>`)
      .join('');

    return `
      <div class="cl-card${i === 0 ? ' cl-card-current' : ''}">
        <div class="cl-card-hdr">
          <div class="cl-vrow">
            <span class="cl-ver">v${escHtml(entry.version)}</span>
            ${badge}
            ${current}
          </div>
          <span class="cl-date">${dateStr}</span>
        </div>
        <ul class="cl-items">${items}</ul>
      </div>`;
  }).join('');
}

function _fmtDate(str) {
  if (!str) return '';
  try {
    const d = new Date(str);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return str; }
}
