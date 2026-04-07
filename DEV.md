# DEV.md — Guide développeur Lutility

> Référence rapide pour naviguer et modifier le code.

---

## Structure des fichiers

```
Lutility-electron/
├── main.js           — Processus principal Electron (IPC, Node fs, fenêtre, tray, spellcheck)
├── preload.js        — contextBridge : expose window.api au renderer (contextIsolation)
├── renderer.html     — Shell HTML unique : titlebar, launch screen, app, modals, <script>
├── tutorials.json    — Tutoriels bundlés (fallback hors-ligne + source en dev)
├── package.json      — Métadonnées, scripts npm, config electron-builder
├── css/style.css     — Tout le CSS (thèmes, densité, composants)
└── js/
    ├── state.js      — Globales : S (état), savPath, profile, P_EMOJIS, PLAT, GAMES, migrations
    ├── persist.js    — I/O JSON (wJSON/rJSON), images blob, autoSave, heartbeat, export MD
    ├── launch.js     — Écran lancement : wizard 4 étapes, carte retour/perdu, startApp()
    ├── app.js        — Core renderer : update, home, thèmes, nav, modals, context menu, init
    ├── notes.js      — Carnets 5 niveaux, éditeur contenteditable, drag&drop, images, corbeille
    ├── jeux.js       — Jeux : binds, sets, codes, manette (PS/Xbox/Switch), drag&drop
    ├── tools.js      — Outils intégrés, température, programmes recommandés, raccourcis, scripts
    ├── tutos.js      — Tutoriels : chargement, filtres catégorie/jeu/recherche, panneau détail
    └── changelog.js  — Tableau CHANGELOG statique + rendu HTML
```

---

## Ordre de chargement (renderer.html)

```
state.js → persist.js → launch.js → app.js → jeux.js → notes.js → tools.js → tutos.js → changelog.js
```

`escHtml` est défini dans `tools.js` — ne pas l'appeler au niveau module dans les fichiers chargés avant.

---

## Flux de démarrage

```
main.js                          renderer.html / js
───────────────────────────────  ────────────────────────────────────────────
app.whenReady()
  loadSpeller()                  — charge .dic en arrière-plan (async)
  createWindow()                 — BrowserWindow frameless, preload.js injecté
  createTray()
                                 scripts chargés dans l'ordre ci-dessus
                                 initLaunchScreen()
                                   configLoad() → savPath + profile ?
                                     oui → folderExists() ?
                                       oui  → showReturnCard() → startApp()
                                       non  → showLostCard()
                                     non  → showWizard() (4 étapes)
                                 startApp()
                                   loadAll() — lit games, notebooks, notes,
                                               shortcuts, customTools, trash
                                   render* sur chaque module
                                   applyAppPrefs() + applyHomeVisibility()
                                   checkForUpdate() (async, silencieux)
                                   heartbeat 5s → folderExists()
```

---

## Où modifier quoi

| Je veux…                              | Fichier           | Fonction / Zone                                      |
|---------------------------------------|-------------------|------------------------------------------------------|
| Ajouter un outil intégré              | `js/tools.js`     | Tableau `TOOLS` — objet `{ico, name, tag, tc, desc, admin, type, cmd}` |
| Ajouter un programme recommandé       | `js/tools.js`     | Tableau `PROGRAMMES`                                 |
| Ajouter/modifier un tutoriel          | `tutorials.json`  | Tableau JSON (voir format ci-dessous)                |
| Ajouter une version au changelog      | `js/changelog.js` | Tableau `CHANGELOG`                                  |
| Modifier les thèmes de couleur        | `js/app.js`       | Tableau `THEMES`                                     |
| Modifier les tailles de texte         | `js/app.js`       | Tableau `TEXT_SIZES`                                 |
| Modifier les densités                 | `js/app.js`       | Tableau `DENSITY`                                    |
| Ajouter une carte Home                | `js/app.js`       | Tableau `HOME_MENU`                                  |
| Modifier la logique de sauvegarde     | `js/persist.js`   | `saveAll()`, `autoSave()`                            |
| Ajouter un handler IPC                | `main.js`         | `ipcMain.handle('nom', ...)`                         |
| Exposer une nouvelle API au renderer  | `preload.js`      | `contextBridge.exposeInMainWorld`                    |
| Modifier le style visuel              | `css/style.css`   | Variables CSS `--accent`, classes `.theme-*`         |
| Ajouter une page dans l'app           | `renderer.html`   | `<div class="page" id="p-xxx">` + bouton nav         |

---

## Données — config.json

Stocké dans `%APPDATA%/lutility/config.json` (prod) ou `%APPDATA%/lutility-dev/config.dev.json` (dev).
Sauvegarde automatique dans `.bak` à chaque écriture (`writeConfig`).

```json
{
  "savPath": "C:/Users/.../Lutility_SAV",
  "profile": { "name": "Alex", "emoji": "🎮", "folderHint": "C:/Users/.../Lutility_SAV" },
  "closeAction": "minimize",
  "appPrefs": { "theme": "", "density": "normal", "textSize": "md" },
  "homeViz": {
    "cards": { "jeux": true, "notes": true, "shortcuts": true, "programmes": true, "tools": true },
    "nav":   { "jeux": true, "notes": true, "shortcuts": true, "programmes": true, "tools": true, "maj": true },
    "prefs": { "clock": true, "navLabels": true }
  }
}
```

**Données utilisateur** dans `Lutility_SAV/` :

| Fichier                    | Contenu                                              |
|----------------------------|------------------------------------------------------|
| `games.json`               | Tableau jeux avec binds, sets, codes, type manette   |
| `notebooks.json`           | Arborescence carnets (5 niveaux : carnet→cat→sec→page→subpage) |
| `notes.json`               | Contenu HTML des pages (clé → HTML)                  |
| `shortcuts.json`           | `[{id, name, emoji, path}]`                          |
| `custom-tools.json`        | `[{id, ico, name, desc, cmd, type, admin}]`          |
| `trash.json`               | Corbeille (max 20 items, restaurables)               |
| `images/img_*.{jpg,png}`   | Images des notes (max 1920px, JPEG 85%)              |

**Clé de note** : `nb{nbId}_cat{catId}_s{secId}_p{pageId}_sp{subId|root}`

---

## Tutoriels

### Ajouter un tutoriel

1. Éditer `tutorials.json` à la racine du projet.
2. Pousser sur la branche `main` du repo GitHub — l'app récupère le fichier automatiquement au prochain lancement (prod).

### Format JSON

```json
{
  "id": 42,
  "title": "Titre du tutoriel",
  "category": "windows",
  "date": "2026-04",
  "description": "Courte description affichée sur la carte.",
  "game": "Nom du jeu",
  "steps": [
    {
      "text": "Texte de l'étape. **Gras** avec doubles astérisques.\nSaut de ligne avec \\n.",
      "note": "💡 Callout optionnel affiché sous le texte de l'étape.",
      "image": "nom-image.png"
    }
  ]
}
```

- **Catégories valides :** `windows` · `gaming` · `programme` · `autres`
- **`game`** : optionnel, catégorie `gaming` uniquement — active le filtre par jeu
- **`image`** : nom de fichier dans `tutorials-img/` (chemin relatif depuis renderer.html)

### Stratégie de chargement (prod)

1. Cache AppData (`tutorials-cache.json`) → retourné immédiatement
2. Fetch GitHub en arrière-plan → met à jour le cache pour la prochaine session
3. Si pas de cache → fetch bloquant → fallback `tutorials.json` bundlé

---

## Thèmes & apparence

Les thèmes sont des classes CSS appliquées sur `<body>` :

| Type       | Classes possibles                                                                     | Variable modifiée              |
|------------|---------------------------------------------------------------------------------------|--------------------------------|
| Couleur    | *(vide)* · `theme-blue` · `theme-violet` · `theme-green` · `theme-orange` · `theme-red` · `theme-rose` | `--accent`, `--accent-dim` |
| Densité    | `density-compact` · `density-normal` · `density-comfort`                              | paddings, gaps                 |
| Taille     | `text-sm` · `text-md` · `text-lg`                                                     | `--fs-base`                    |

**Ajouter un thème :**

1. `js/app.js` → tableau `THEMES` :
   ```js
   { key: 'gold', color: '#f59e0b', label: 'Or' },
   ```
2. `css/style.css` :
   ```css
   body.theme-gold { --accent: #f59e0b; --accent-dim: rgba(245,158,11,.15); }
   ```

---

## Conventions

### IPC (main ↔ renderer)

```js
// renderer
const result = await window.api.monAction(arg);

// preload.js
monAction: (arg) => ipcRenderer.invoke('mon-action', arg),

// main.js
ipcMain.handle('mon-action', (_e, arg) => { /* Node.js */ });
```

Utiliser `ipcRenderer.send` / `ipcMain.on` pour les événements sans retour (ex: `win-minimize`).

### Écriture fichier atomique

Passer par `atomicWrite()` dans main.js : écrit dans `.tmp` puis `fs.renameSync()` — jamais de fichier à moitié écrit.

### Helpers courants

| Pattern            | Usage                                                              |
|--------------------|--------------------------------------------------------------------|
| `toast(msg)`       | Notification bas-écran — `toast('✅ OK')` / `toast('Err', 'err')` |
| `escHtml(s)`       | Échapper avant injection `innerHTML` (défini dans `tools.js`)      |
| `nav(id)`          | Changer de page — `nav('jeux')`, `nav('home')`                     |
| `openModal(id)`    | Ouvrir un overlay — `openModal('modal-profile')`                   |
| `saveAll()`        | Sauvegarde tout l'état `S{}` (persist.js, via autoSave de préférence) |
| `window.api.*`     | Tout accès Node/système passe par preload.js                       |
| `S.*`              | État global — `S.games`, `S.notes`, `S.activeGame`…                |
| `wJSON / rJSON`    | Écriture/lecture JSON dans `savPath` (persist.js)                  |
| `_fonction()`      | Préfixe `_` = privé au module, ne pas appeler de l'extérieur       |

### Sauvegarde

`saveAll()` utilise un mutex (`_saving` / `_pendingSave`) pour éviter les écritures concurrentes. Préférer `autoSave()` qui debounce à 800ms (+ intervalle 30s).

### Images dans les notes

Pipeline : fichier/presse-papiers → `compressImg()` (canvas, max 1920px, JPEG 85%) → base64 → `fileWriteBinary()` → `images/img_*.jpg` → affiché via blob URL (`data-src` → `resolveNoteImages()`).

### Dev vs prod

```js
if (!app.isPackaged) { /* dev */ }
```

En dev : userData → `lutility-dev/`, config → `config.dev.json`, tutoriels → fichier local (pas de fetch GitHub).

---

## Build & release

```bash
# Développement
npm start                     # npx electron .

# Production (installer NSIS)
npm run build-installer       # → dist/Lutility-Setup-x.x.x.exe
```

Avant le build, mettre à jour :
- `package.json` → `"version"`
- `js/changelog.js` → nouvelle entrée en tête de `CHANGELOG`
