# LUTILITY v1.28.0

> Utilitaire personnel gaming sous Electron — Windows uniquement.
> Interface dark, données sauvegardées localement (clef USB ou PC).

---

## Téléchargement

👉 [Lutility Setup 1.28.0.exe](https://github.com/ALuffyi/Lutility/raw/main/dist/Lutility%20Setup%201.28.0.exe)

---

## Fonctionnalités

| Module | Description |
|---|---|
| 🎮 **Jeux** | Liste personnelle avec plateforme, emoji, notes de session |
| 📓 **Carnets** | Éditeur riche : titres, listes, tableaux, images embarquées |
| 🗒️ **Notes rapides** | Notes libres par catégorie |
| 🛠️ **Outils** | Raccourcis, commandes CMD/PS, outils système (admin ou non) |
| 💾 **Sauvegarde** | Dossier `Lutility_SAV` portable (USB recommandé) |
| 🔄 **Mises à jour** | Badge discret si nouvelle version disponible |

---

## Installation

1. Télécharger `Lutility Setup 1.28.0.exe`
2. Lancer l'installateur (choix du répertoire, raccourcis bureau/démarrer)
3. Démarrer Lutility → wizard de premier lancement (profil + dossier SAV)

---

## Lancer en développement

```
Double-clic sur run.bat
```
- Installe les dépendances si absent (`node_modules/`)
- Lance `npx electron .` — aucun `.exe` généré

> Prérequis : [Node.js](https://nodejs.org) installé

---

## Générer l'installateur

```
Double-clic sur build.bat
```
Produit : `dist/Lutility Setup 1.28.0.exe` (NSIS x64)

---

## Structure

```
Lutility-electron/
├── main.js           ← Process principal Electron (IPC, fichiers, système)
├── preload.js        ← Pont contextBridge (window.api)
├── renderer.html     ← Interface complète
├── version.json      ← Vérification des mises à jour
├── package.json      ← Config npm + electron-builder
├── css/style.css     ← Styles globaux
├── assets/icon.ico   ← Icône application
└── js/
    ├── state.js      ← État global + constantes
    ├── launch.js     ← Wizard démarrage (4 étapes) + carte retour
    ├── persist.js    ← Lecture/écriture fichiers via IPC
    ├── app.js        ← Navigation, modals, profil, horloge, MAJ
    ├── jeux.js       ← Module Jeux
    ├── notes.js      ← Module Carnets / Notes
    └── tools.js      ← Module Outils (raccourcis, commandes, programmes)
```

---

## Sécurité

- `contextIsolation: true` + `nodeIntegration: false`
- Accès système uniquement via `preload.js` (surface minimale)
- CSP stricte dans `renderer.html`
- Commandes admin via `Start-Process -Verb RunAs` (UAC Windows)

---

## Stack

`Electron 28` · `Vanilla JS` · `electron-builder 25` · `NSIS` · `Windows x64`
