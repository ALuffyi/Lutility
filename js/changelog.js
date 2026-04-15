// ══ CHANGELOG ════════════════════════════════════════════
const CHANGELOG = [
  {
    version: '2.17.1',
    date:    '2026-04-15',
    type:    'fix',
    changes: [
      'Menu MàJ : versions affichées de la plus récente à la plus ancienne',
      'Badge version installée / à jour visible à l\'ouverture sans défilement',
    ]
  },
  {
    version: '2.17.0',
    date:    '2026-04-15',
    type:    'feat',
    changes: [
      'Sommaire tutoriels repositionné dans la colonne gauche — navigation permanente',
      'Bouton d\'accès direct au dossier Photos depuis la barre d\'outils Notes',
      'Renommage automatique des images : Profil_Menu_Date',
      'Versions dynamiques dans MàJ : installée / disponible / à jour',
      'Suppression de la fonction Ctrl+Espace (QuickSearch)',
    ]
  },
  {
    version: '2.16.0',
    date:    '2026-04-07',
    type:    'feat',
    changes: [
      'Personnalisation de l\'interface : 7 thèmes de couleur accent, 3 tailles de texte, 3 niveaux de densité — via ⚙️ Settings',
      'Tutoriel #17 — Activer le mode développeur Discord (avec image)',
      'Topbar : boutons renommés ⚙️ Settings et 💾 Sauvegarde',
      'Correction : home vide au démarrage',
      'Correction : tutoriels invisibles en production depuis la v2.15.0',
      'Correction : label Sauvegarde écrasé lors de l\'autosave',
    ]
  },
  {
    version: '2.15.0',
    date:    '2026-04-07',
    type:    'feat',
    changes: [
      'Tutoriels : nouvelle page dédiée avec catégories, recherche et panneau latéral',
      'Tutoriels : 16 guides intégrés (Windows, Gaming, Programme, Autres)',
      'Tutoriels : filtre par jeu dans la catégorie Gaming',
      'Tutoriels : support images, texte gras et notes callout dans les étapes',
      'Tutoriels : fetch automatique depuis GitHub (màj sans rebuild)',
      'Navigation : Tutos repositionné au-dessus de MàJ dans la barre latérale',
    ]
  },
  {
    version: '2.14.2',
    date:    '2026-04-07',
    type:    'fix',
    changes: [
      'Correcteur orthographique : suggestions françaises via dictionnaire bundlé',
      'Correcteur : ajout et suppression de mots dans le dictionnaire personnel',
      'Notes : export de la page en PDF (clic droit → Exporter en PDF)',
      'Notes : barre image simplifiée (Monter / Descendre / Supprimer)',
      'Apps : reclassement des catégories (Navigateurs, Périphériques, Gaming…)',
      'Menu contextuel : section presse-papiers masquée au clic sur une image',
    ]
  },
  {
    version: '2.14.1',
    date:    '2026-04-07',
    type:    'fix',
    changes: [
      'Scripts : lancement identique à un double-clic Windows (ShellExecute)',
      'Scripts : affichage unifié avec les Raccourcis (même tuile, icône réelle)',
      'Bouton Quitter : fermeture complète de l\'app corrigée',
      'Lien de téléchargement Corsair iCUE corrigé',
      'Ajout de Wootility (Wooting) dans les Périphériques',
      'Panneau Tips supprimé de la page Raccourcis',
    ]
  },
  {
    version: '2.14.0',
    date:    '2026-04-07',
    type:    'feat',
    changes: [
      'Scripts fusionnés dans Raccourcis — sélection de fichier .bat/.cmd/.ps1 uniquement',
      'Scripts : s\'ouvrent dans un terminal visible, indépendant de l\'app',
      'Changement de dossier : copie intégrale des données + images',
      'Dossier SAV synchronisé avec le nom du profil (renommage automatique)',
      'Synchronisation du profil (nom + emoji) à l\'import d\'une sauvegarde',
      'Contenu d\'exemple au premier lancement (jeu + carnet structuré)',
      'Catégories Outils et Apps fermées par défaut, ouverture en un clic',
      'Différenciation visuelle des catégories par couleur (Outils + Apps)',
    ]
  },
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
  let latest  = '';
  const [verRes, updRes] = await Promise.allSettled([
    window.api.getVersion(),
    window.api.checkUpdate(),
  ]);
  if (verRes.status === 'fulfilled') current = verRes.value  || '';
  if (updRes.status === 'fulfilled') latest  = updRes.value?.version || '';

  const upToDate = !latest || latest === current || !semverGt(latest, current);

  wrap.innerHTML = CHANGELOG.map(entry => {
    const isCurrent = current && entry.version === current;
    const isLatest  = !upToDate && latest && entry.version === latest;
    const dot       = entry.type === 'feat' ? 'feat' : 'fix';
    const items     = entry.changes.map(c => `<li>${escHtml(c)}</li>`).join('');

    let badge = '';
    if (isCurrent && upToDate)   badge = '<span class="cl-cur-tag cl-tag-ok">✓ à jour</span>';
    else if (isCurrent)          badge = '<span class="cl-cur-tag">installée</span>';
    else if (isLatest)           badge = '<span class="cl-cur-tag cl-tag-new">↑ disponible</span>';

    return `<div class="cl-card${isCurrent ? ' cl-card-cur' : ''}${isLatest ? ' cl-card-new' : ''}">
      <div class="cl-hdr">
        <span class="cl-dot ${dot}"></span>
        <span class="cl-ver">v${escHtml(entry.version)}</span>
        ${badge}
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
