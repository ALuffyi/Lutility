// ── Changelog / Patch Notes ───────────────────────────
const CHANGELOG = [
  {
    version: '2.12.2',
    date:    '2026-04-05',
    type:    'fix',
    changes: [
      'Icônes réelles des apps et raccourcis dans le menu Raccourcis (remplacement des émojis par l\'icône du fichier)',
      'Correctif : copie d\'image dans l\'éditeur — copie le contenu réel, pas le texte alt',
      'Menu MàJ (patch notes) : historique des versions consultable dans l\'app',
      'Numérotation de version corrigée et synchronisée partout',
    ]
  },
  {
    version: '2.12.0',
    date:    '2026-04-05',
    type:    'feat',
    changes: [
      'Manette découplée de la plateforme — sélecteur ⌨️ PC / PS / Xbox / Switch par jeu',
      'Boutons colorés avec codes visuels PlayStation (✕ ○ □ △), Xbox (A/B/X/Y), Switch (A/B/X/Y)',
      'Sticks analogiques 🕹️ Gauche et Droit, D-Pad dans les chips de touches',
      'Pavé tactile PlayStation divisé en zone Gauche / Droite',
      'Suppression de jeux sans freeze (sauvegarde asynchrone)',
      'Cases d\'action à largeur automatique selon le contenu',
      'DriversCloud.com dans les outils de mise à jour drivers',
      'Section Mises à jour regroupée directement sous Informations Système',
      'Téléchargement et installation des mises à jour en arrière-plan avec barre de progression',
      'Auto-update : l\'installateur se lance et remplace l\'app sans intervention manuelle',
    ]
  },
  {
    version: '2.11.0',
    date:    '2026-04-05',
    type:    'feat',
    changes: [
      'Icône dans la barre des tâches système (tray) — l\'app reste accessible même fenêtre fermée',
      'Redimensionnement du panneau latéral des carnets par glisser-déposer',
      'Correctif : images rechargées correctement depuis Lutility_SAV au redémarrage',
      'Correctif : bouton MàJ masqué proprement, LED d\'état sans clignotement en mode normal',
      'Tooltip sur les noms de notes tronqués',
      'Boutons manette affichés selon la plateforme détectée',
    ]
  },
  {
    version: '2.0.0',
    date:    '2026-04-04',
    type:    'feat',
    changes: [
      'Version initiale complète sous Electron (migration depuis v1.x web)',
      'Module Jeux : bibliothèque, touches, paramètres graphiques, codes',
      'Module Notes / Carnets : éditeur riche, tableaux, images embarquées, sous-pages',
      'Module Outils : commandes CMD/PS, infos système, programmes recommandés, raccourcis',
      'Sauvegarde locale portable dans Lutility_SAV (clef USB ou PC)',
      'Mises à jour automatiques via GitHub Releases',
      'Installation via installateur NSIS (setup .exe)',
    ]
  },
];

async function loadChangelog() {
  const wrap = document.getElementById('cl-list');
  if (!wrap) return;

  // Récupère la version installée depuis Electron
  let current = '';
  try { current = await window.api.getVersion(); } catch {}

  // Affiche la version courante dans le header
  const hdr = document.getElementById('cl-ver-hdr');
  if (hdr && current) hdr.textContent = 'Version installée : v' + current;

  wrap.innerHTML = CHANGELOG.map(entry => {
    const isCurrent = current && entry.version === current;
    const isFeat    = entry.type === 'feat';
    const badge     = isFeat
      ? '<span class="cl-badge feat">🆕 Nouveauté</span>'
      : '<span class="cl-badge fix">🔧 Correctif</span>';
    const curTag    = isCurrent ? '<span class="cl-current">VERSION INSTALLÉE</span>' : '';
    const dateStr   = _fmtDate(entry.date);
    const items     = entry.changes
      .map(c => `<li class="cl-item">${escHtml(c)}</li>`)
      .join('');

    return `
      <div class="cl-card${isCurrent ? ' cl-card-current' : ''}">
        <div class="cl-card-hdr">
          <div class="cl-vrow">
            <span class="cl-ver">v${escHtml(entry.version)}</span>
            ${badge}
            ${curTag}
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
    return new Date(str).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return str; }
}
