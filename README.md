# LUTILITY v2.12.1

> Utilitaire personnel gaming sous Electron — Windows uniquement.
> Interface dark, données sauvegardées localement (clef USB ou PC).

---

## Téléchargement

👉 [Lutility-Setup-2.12.1.exe](https://github.com/ALuffyi/Lutility/releases/latest/download/Lutility-Setup-2.12.1.exe)

---

## Fonctionnalités

| Module | Description |
|---|---|
| 🎮 **Jeux** | Liste personnelle, touches/manette par jeu (PS/Xbox/Switch/PC), codes, paramètres |
| 📓 **Carnets** | Éditeur riche : titres, listes, tableaux, images embarquées, sous-pages |
| 🛠️ **Outils** | Commandes CMD/PS, outils système, infos matériel, mises à jour, raccourcis avec icônes réelles |
| 💾 **Sauvegarde** | Dossier `Lutility_SAV` portable (USB recommandé) |
| 🔄 **Mises à jour** | Badge discret + notification si nouvelle version disponible |
| 🖥️ **Système** | Infos matériel (CPU, GPU, RAM, disques), pilote NVIDIA, températures |

---

## Installation

1. Télécharger `Lutility-Setup-2.12.1.exe`
2. Lancer l'installateur (choix du répertoire, raccourcis bureau/démarrer)
3. Démarrer Lutility → wizard de premier lancement (profil + dossier SAV)

> Les données (`Lutility_SAV`) sont indépendantes de l'installation — une mise à jour ne supprime rien.

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
Produit : `dist/Lutility-Setup-2.12.1.exe` (NSIS x64)

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
