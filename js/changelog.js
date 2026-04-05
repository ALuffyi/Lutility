// ── Changelog / Patch Notes ───────────────────────────
const CHANGELOG = [
  {
    version: '2.13.0',
    date:    '2026-04-05',
    type:    'feat',
    changes: [
      'Menu MàJ : historique des versions dans l\'app',
      'Icônes réelles des apps dans les Raccourcis',
      'Copie d\'image : copie le contenu réel (pas le texte alt)',
    ]
  },
  {
    version: '2.12.0',
    date:    '2026-04-05',
    type:    'feat',
    changes: [
      'Manette découplée : sélecteur PC / PS / Xbox / Switch par jeu',
      'Boutons colorés PS (✕ ○ □ △), Xbox (A B X Y), Switch',
      'Sticks analogiques et pavé tactile PS (Gauche / Droite)',
      'Suppression de jeux sans freeze',
      'Cases action à largeur automatique',
      'DriversCloud dans les outils MàJ',
      'Auto-update : téléchargement + installation en arrière-plan',
    ]
  },
  {
    version: '2.11.0',
    date:    '2026-04-05',
    type:    'feat',
    changes: [
      'Icône tray système (app accessible même fenêtre fermée)',
      'Redimensionnement du panneau carnets',
      'Correctifs images, LED et bouton MàJ',
    ]
  },
  {
    version: '2.0.0',
    date:    '2026-04-04',
    type:    'feat',
    changes: [
      'Version Electron initiale (migration depuis v1.x)',
      'Modules Jeux, Notes, Outils, Raccourcis, Scripts',
      'Sauvegarde portable Lutility_SAV',
      'Mises à jour via GitHub Releases',
    ]
  },
];

async function loadChangelog() {
  const wrap = document.getElementById('cl-list');
  if (!wrap) return;
  let current = '';
  try { current = await window.api.getVersion(); } catch {}
  wrap.innerHTML = CHANGELOG.map(entry => {
    const isCurrent = current && entry.version === current;
    const dot  = entry.type === 'feat' ? 'feat' : 'fix';
    const items = entry.changes.map(c => `<li>${escHtml(c)}</li>`).join('');
    return `<div class="cl-card${isCurrent ? ' cl-card-cur' : ''}">
      <div class="cl-hdr">
        <span class="cl-dot ${dot}"></span>
        <span class="cl-ver">v${escHtml(entry.version)}</span>
        ${isCurrent ? '<span class="cl-cur-tag">installée</span>' : ''}
        <span class="cl-date">${_fmtDate(entry.date)}</span>
      </div>
      <ul class="cl-items">${items}</ul>
    </div>`;
  }).join('');
}

function _fmtDate(str) {
  try { return new Date(str).toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' }); }
  catch { return str; }
}
