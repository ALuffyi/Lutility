# LUTILITY v2.0.0 — Documentation complète

Utilitaire personnel gaming sous Electron (Windows). Fenêtre sans cadre, interface dark, données sauvegardées localement.

---

## Prérequis

- **Node.js** (https://nodejs.org) — requis pour lancer ou builder
- **Windows** — seule plateforme cible (build NSIS x64)

---

## Lancer l'application

### Mode développement (sans build)
```
Double-clic sur run.bat
```
- Vérifie que Node.js est installé
- Installe les dépendances (`npm install`) si `node_modules/` est absent
- Lance l'app via `npx electron .` — aucun `.exe` généré

### Générer le .exe (distribution)
```
Double-clic sur build.bat
```
- Installe les dépendances
- Lance `electron-builder --win --x64`
- Produit : `dist/Lutility Setup 2.0.0.exe` (installeur NSIS)
- Options installeur : choix du répertoire, raccourci bureau + menu démarrer

---

## Structure des fichiers

```
Lutility-electron/
├── run.bat           ← Lancer en dev (pas de build)
├── build.bat         ← Générer le .exe installeur
├── main.js           ← Process principal Electron (Node.js)
├── preload.js        ← Pont IPC sécurisé (contextBridge)
├── renderer.html     ← Interface complète (HTML + chargement des modules JS)
├── package.json      ← Config npm + electron-builder
├── css/style.css     ← Styles globaux
└── js/
    ├── state.js      ← État global S, constantes (GAMES, PLAT…)
    ├── launch.js     ← Écran de démarrage / wizard 3 étapes
    ├── persist.js    ← Lecture/écriture fichiers via IPC
    ├── app.js        ← Navigation, modals, horloge, profil
    ├── jeux.js       ← Menu Jeux (ajout, affichage, gestion)
    ├── notes.js      ← Menu Notes (carnets, sections, éditeur riche)
    └── tools.js      ← Menu Tools (commandes CMD/PS exécutables)
```

> **Ordre de chargement JS** (dépendances) : `state → launch → persist → app → jeux → notes → tools`

---

## Architecture

### `main.js` — Process principal (Node.js / Electron)

Point d'entrée Electron. Gère :

**Fenêtre**
- Crée une `BrowserWindow` 1280×800, sans cadre (`frame: false`), fond `#080a0d`
- `contextIsolation: true`, `nodeIntegration: false` → sécurité maximale
- Chargement de `renderer.html`

**Contrôles fenêtre** (IPC one-way)
| Canal | Action |
|---|---|
| `win-minimize` | Réduire |
| `win-maximize` | Maximiser / restaurer |
| `win-close` | Fermer |

**Config** (`%AppData%\Lutility\config.json`)
| Canal | Action |
|---|---|
| `config-load` | Lire le JSON de config |
| `config-save` | Écrire le JSON de config |

**Dossier de sauvegarde**
| Canal | Action |
|---|---|
| `choose-folder` | Ouvre un sélecteur de dossier, crée `Lutility_SAV/notes/` et `Lutility_SAV/images/` |
| `folder-exists` | Vérifie qu'un chemin est un dossier valide |

**Fichiers** (lecture/écriture dans `Lutility_SAV/`)
| Canal | Action |
|---|---|
| `file-read` | Lit un fichier texte (UTF-8) |
| `file-write` | Écrit un fichier texte |
| `file-read-binary` | Lit un fichier binaire → base64 |
| `file-write-binary` | Écrit un fichier binaire depuis base64 |

**Exécution système**
| Canal | Action |
|---|---|
| `exec-cmd` | Exécute une commande CMD ou PowerShell (timeout 30s) |
| `exec-admin` | Exécute en tant qu'Administrateur via `Start-Process -Verb RunAs` (timeout 60s) |

---

### `preload.js` — Pont IPC sécurisé

Expose `window.api` au renderer via `contextBridge`. Le renderer n'a **aucun accès direct à Node.js**.

```js
window.api.minimize()
window.api.maximize()
window.api.close()
window.api.configLoad()           // → Promise<config|null>
window.api.configSave(data)       // → Promise<true>
window.api.chooseFolder()         // → Promise<savePath|null>
window.api.folderExists(path)     // → Promise<bool>
window.api.fileRead(p, f)         // → Promise<string|null>
window.api.fileWrite(p, f, c)     // → Promise<bool>
window.api.fileReadBinary(p, f)   // → Promise<base64|null>
window.api.fileWriteBinary(p,f,b) // → Promise<bool>
window.api.execCmd(cmd, type)     // type: 'CMD'|'PS' → Promise<{ok, out}>
window.api.execAdmin(cmd, type)   // → Promise<{ok, out}>
```

---

### `renderer.html` — Interface utilisateur

Fenêtre unique, structurée en deux zones :

**Titlebar personnalisée** (32px, draggable)
- Logo `LUTILITY` centré
- Boutons fenêtre (minimiser, maximiser, fermer) à droite, non-draggable

**Écran de lancement (`#launch`)**

Affiché au démarrage selon l'état de la config :

- **Wizard 3 étapes** (`#card-setup`) — premier lancement :
  1. **Profil** : saisie du nom + choix d'un emoji dans une grille
  2. **Dossier** : sélection du dossier `Lutility_SAV` (recommandé : clef USB)
  3. **Confirmation** : résumé + bouton lancer
  
- **Retour utilisateur** (`#card-return`) — config existante :
  - Affiche nom + emoji du profil
  - Statuts : Profil / Dossier / Données (icônes colorées)
  - Boutons : Ouvrir / Réparer le dossier / Reconfigurer

**Application principale (`#app`)**

Masquée jusqu'à validation du wizard. Contient :

- **Topbar** : logo, chip profil (cliquable → modal), chip dossier SAV (cliquable → modal), horloge
- **Sidebar** : navigation entre les 3 menus
- **Pages** :
  - `#p-jeux` — Menu Jeux
  - `#p-notes` — Éditeur de notes (sidebar carnet/section, éditeur riche avec toolbar)
  - `#p-tools` — Grille de commandes exécutables

**Modals**
| ID | Rôle |
|---|---|
| `modal-game` | Ajouter un jeu (plateforme, nom, emoji) avec autocomplete |
| `modal-profile` | Modifier nom + emoji du profil |
| `modal-folder` | Changer le dossier de sauvegarde |
| `modal-nb` | Créer/éditer un carnet (nom + emoji) |
| `modal-rename` | Renommer une section ou sous-section |

**Éditeur de notes — toolbar**
Bold, Italic, Underline, Strikethrough, H1/H2/H3, Paragraphe, Liste à puces, Liste numérotée, Tableau (popup colonnes×lignes), Image, Effacer formatage, Sauvegarder.

**CSP** : ressources externes autorisées uniquement pour Google Fonts (`Rajdhani`, `Share Tech Mono`, `Exo 2`).

---

### `package.json`

```json
{
  "name": "lutility",
  "version": "2.0.0",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder --win --x64"
  }
}
```

**Dépendances dev** : `electron ^28`, `electron-builder ^24`

**Config build (electron-builder)** :
- `appId` : `com.lutility.app`
- Cible : NSIS Windows x64
- Icône : `assets/icon.ico`
- Installeur : non one-click, choix du répertoire, raccourcis bureau + démarrer
- Fichiers packagés : `main.js`, `preload.js`, `renderer.html`, `css/`, `js/`, `assets/`
- Sortie : `dist/`

---

## Données sauvegardées

| Fichier | Emplacement | Contenu |
|---|---|---|
| `config.json` | `%AppData%\Lutility\` | Nom, emoji, chemin `savePath` |
| Données app | `<savePath>/Lutility_SAV/` | Notes, jeux, tools… |
| Notes | `Lutility_SAV/notes/` | Fichiers JSON par carnet |
| Images | `Lutility_SAV/images/` | Images embarquées dans les notes |

Le chemin `savePath` est choisi librement au premier lancement (clef USB recommandée pour portabilité).

---

## Sécurité

- `contextIsolation: true` + `nodeIntegration: false` → le renderer ne peut pas appeler Node directement
- Tout accès système passe par `preload.js` (surface minimale exposée)
- CSP stricte dans `renderer.html` (pas de scripts externes arbitraires)
- Exécution admin via `Start-Process -Verb RunAs` (UAC Windows déclenché)
