# LUTILITY — Guide développeur

> Référence rapide pour naviguer et modifier le code.

---

## Structure des fichiers

```
Lutility-electron/
├── main.js              Processus principal Electron — IPC, fichiers, fenêtre, tray, MAJ
├── preload.js           Pont contextBridge → expose window.api au renderer
├── renderer.html        HTML complet de l'UI (tout est dans ce fichier)
├── css/style.css        Styles globaux (dark theme, composants, thèmes, densité)
├── version.json         Version courante + URL de release (utilisé par le checker MAJ)
├── tutorials.json       Tutoriels bundlés (fallback offline + source en dev)
├── tutorials-img/       Images des tutoriels (nom de fichier référencé dans tutorials.json)
├── changelog.json       Historique des versions affiché dans l'onglet MàJ
├── assets/icon.ico      Icône application
├── build.bat            Lance electron-builder → dist/Lutility-Setup-x.x.x.exe
├── run.bat              Lance en dev (npx electron .)
└── js/
    ├── state.js         État global (S), profil, savPath — partagé par tous les modules
    ├── launch.js        Wizard premier lancement (4 étapes) + carte "dossier perdu"
    ├── persist.js       Lecture/écriture fichiers (wJSON/rJSON), saveAll, LED, heartbeat
    ├── app.js           Nav, modals, horloge, MAJ, apparence, home cards, Settings modal
    ├── jeux.js          Module Jeux — CRUD fiches, keybinds, paramètres, codes
    ├── notes.js         Module Notes — carnets, éditeur rich-text, images, sous-pages
    ├── tools.js         Module Outils — raccourcis, commandes, programmes, infos système
    ├── tutos.js         Module Tutoriels — liste, filtre, panneau détail
    └── changelog.js     Affichage du changelog dans l'onglet MàJ
```

---

## Ordre de chargement (renderer.html)

```
state.js → launch.js → persist.js → app.js → jeux.js → notes.js → tools.js → changelog.js → tutos.js
```

> `escHtml` est défini dans `tools.js` — ne pas l'appeler au niveau module dans les fichiers chargés avant.

---

## Flux de démarrage

```
1. renderer.html charge les scripts dans l'ordre ci-dessus
2. state.js     → initialise S{}, savPath, profile
3. launch.js    → vérifie si savPath existe → si non, affiche le wizard
4. persist.js   → loadAll() lit les JSON du dossier SAV
5. app.js       → renderHomeCards() (sync), puis async : charge config, appPrefs, homeCfg
6. main.js      → restore closeAction depuis config.json au démarrage
```

---

## Où modifier quoi

| Je veux...                              | Fichier           | Fonction / Zone                  |
|-----------------------------------------|-------------------|----------------------------------|
| Ajouter une carte sur le Home           | `js/app.js`       | `HOME_MENU` array                |
| Changer les thèmes de couleur           | `js/app.js`       | `THEMES` array                   |
| Modifier l'UI d'un module               | `renderer.html`   | Section `#p-<module>`            |
| Ajouter un style CSS                    | `css/style.css`   | Fin du fichier                   |
| Ajouter un tutoriel                     | `tutorials.json`  | Voir format ci-dessous           |
| Modifier l'en-tête de la topbar         | `renderer.html`   | Div `.topbar-right`              |
| Ajouter un raccourci système (IPC)      | `main.js`         | Bloc `ipcMain.handle`            |
| Exposer un IPC au renderer              | `preload.js`      | `contextBridge.exposeInMainWorld`|
| Modifier le wizard de démarrage         | `js/launch.js`    | `initLaunchScreen()`             |
| Changer le comportement de sauvegarde   | `js/persist.js`   | `saveAll()` / `autoSave()`       |
| Modifier les infos système (CPU/GPU...) | `js/tools.js`     | `loadSysInfo()`                  |
| Ajouter une version au changelog        | `changelog.json`  | Ajouter entrée en début de tableau |
| Modifier la version affichée            | `version.json` + `package.json` | `"version"` |

---

## Données — config.json

Stocké dans `%APPDATA%/Lutility/config.json` (prod) ou `config.dev.json` (dev).

```json
{
  "savPath": "C:/chemin/vers/Lutility_SAV",
  "profile": { "name": "Joueur", "emoji": "🎮" },
  "closeAction": "minimize",
  "homeViz": {
    "cards": { "jeux": true, "notes": true, ... },
    "nav":   { "jeux": true, "maj": true, ... },
    "prefs": { "clock": true, "navLabels": true }
  },
  "appPrefs": {
    "theme": "",
    "density": "normal",
    "textSize": "md"
  }
}
```

Données utilisateur (jeux, notes, etc.) dans le dossier `savPath/` :

```
games.json · notebooks.json · notes.json · trash.json
shortcuts.json · custom-tools.json · session.json · profile.json
images/          ← images embarquées des notes
```

---

## Ajouter un tutoriel

Édite `tutorials.json` (ou le fichier sur le repo GitHub pour les utilisateurs en prod) :

```json
{
  "id": 18,
  "title": "Titre du tutoriel",
  "category": "windows",
  "date": "2026-04",
  "description": "Courte description affichée sur la carte.",
  "steps": [
    {
      "text": "Texte de l'étape. Supporte le **gras** et les\nsauts de ligne.",
      "note": "💡 Note optionnelle sous l'étape.",
      "image": "nom-du-fichier.png"
    }
  ]
}
```

**Catégories valides :** `windows` · `gaming` · `programme` · `autres`

**Images :** place le fichier dans `tutorials-img/` et mets uniquement le nom (ex: `"mon-image.png"`).

**Jeu** (gaming uniquement) : ajoute `"game": "Nom du jeu"` pour le filtre par jeu.

---

## Ajouter un thème de couleur

Dans `js/app.js`, ajoute dans le tableau `THEMES` :

```js
{ key:'pink', color:'#ec4899', label:'Rose foncé' },
```

Dans `css/style.css`, ajoute :

```css
body.theme-pink { --cyan: #ec4899; }
```

C'est tout — la couleur s'applique à toute l'UI via `var(--cyan)`.

---

## Conventions

| Pattern          | Usage                                                                 |
|------------------|-----------------------------------------------------------------------|
| `toast(msg)`     | Notification bas-écran (app.js) — `toast('✓ Sauvegardé')`           |
| `escHtml(s)`     | Échappe HTML avant injection innerHTML (défini dans tools.js)        |
| `nav(id)`        | Change de page — `nav('jeux')`, `nav('home')`                        |
| `openModal(id)`  | Ouvre un overlay — `openModal('modal-profile')`                      |
| `saveAll()`      | Sauvegarde tout l'état S{} sur disque (persist.js)                   |
| `window.api.*`   | Tout accès Node/système passe par preload.js (contextIsolation)       |
| `S.*`            | État global — `S.games`, `S.notes`, `S.activeGame`…                  |
| `wJSON/rJSON`    | Écriture/lecture fichiers JSON dans savPath (persist.js)             |
| `_fonction()`    | Préfixe `_` = privé au module, ne pas appeler depuis l'extérieur     |

---

## Build & release

```bash
# Développement
run.bat          # npx electron . (pas de build)

# Production
build.bat        # → dist/Lutility-Setup-x.x.x.exe

# Release GitHub
gh release create vX.X.X dist/Lutility-Setup-X.X.X.exe --title "vX.X.X" --notes "..."
```

Penser à mettre à jour **avant** le build :
- `version.json` → `"version"`, `"url"`, `"notes"`
- `package.json` → `"version"`
- `changelog.json` → nouvelle entrée en tête
