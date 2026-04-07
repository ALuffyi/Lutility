# LUTILITY v2.16.0

> T'as tes paramètres de jeu dans un coin de Discord, tes scripts sur le bureau et tes notes éparpillées partout ? **Lutility regroupe tout ça.**

Fiches de jeux, carnets de notes, tutoriels PC/gaming, lanceur de scripts et outils système — dans une interface dark, **offline et portable sur clé USB**.

&nbsp;

| | |
|---|---|
| ⚡ **Rapide** | Lance en quelques secondes, interface fluide |
| 🔌 **Portable** | Fonctionne depuis une clé USB |
| 🔒 **Offline** | 100% local, aucune donnée envoyée |
| 🆓 **Gratuit** | Open source, pour toujours |

&nbsp;

**Pas de compte. Pas de cloud. Tes données restent chez toi.**

---

## Téléchargement

👉 [Lutility-Setup-2.16.0.exe](https://github.com/ALuffyi/Lutility/releases/latest/download/Lutility-Setup-2.16.0.exe)

---

## Fonctionnalités

| Module | Description |
|---|---|
| 🎮 **Jeux** | Liste personnelle, touches/manette par jeu (PS/Xbox/Switch/PC), codes, paramètres |
| 📓 **Carnets** | Éditeur riche : titres, listes, tableaux, images embarquées, sous-pages |
| 📖 **Tutoriels** | Guides intégrés par catégorie (Windows, Gaming, Programme, Autres), recherche, images, fetch GitHub automatique |
| 🛠️ **Outils** | Outils système, infos matériel, mises à jour, maintenance Windows |
| ⚡ **Raccourcis** | Lanceur d'applications et scripts (.bat/.cmd/.ps1) personnalisés |
| 💾 **Sauvegarde** | Dossier `Lutility_SAV` portable (USB recommandé), export/import intégral |
| 🔄 **Mises à jour** | Badge discret + notification + historique des versions (patch notes intégré) |
| 🎨 **Personnalisation** | Thème de couleur, taille du texte, densité — via ⚙️ Settings |
| 🖥️ **Système** | Infos matériel (CPU, GPU, RAM, disques), pilote NVIDIA, températures |

---

## Installation

1. Télécharger `Lutility-Setup-2.16.0.exe`
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
Produit : `dist/Lutility-Setup-2.16.0.exe` (NSIS x64)

---

## Structure

```
Lutility-electron/
├── main.js              ← Process principal Electron (IPC, fichiers, système)
├── preload.js           ← Pont contextBridge (window.api)
├── renderer.html        ← Interface complète
├── version.json         ← Vérification des mises à jour
├── package.json         ← Config npm + electron-builder
├── tutorials.json       ← Tutoriels bundlés (fallback hors-ligne)
├── tutorials-img/       ← Images des tutoriels
├── css/style.css        ← Styles globaux
├── assets/icon.ico      ← Icône application
└── js/
    ├── state.js         ← État global + constantes
    ├── launch.js        ← Wizard démarrage (4 étapes) + carte retour
    ├── persist.js       ← Lecture/écriture fichiers via IPC
    ├── app.js           ← Navigation, modals, profil, horloge, MAJ
    ├── jeux.js          ← Module Jeux
    ├── notes.js         ← Module Carnets / Notes
    ├── tools.js         ← Module Outils (raccourcis, commandes, programmes)
    ├── tutos.js         ← Module Tutoriels
    └── changelog.js     ← Historique des versions
```

---

## Sécurité

- `contextIsolation: true` + `nodeIntegration: false`
- Accès système uniquement via `preload.js` (surface minimale)
- CSP dans `renderer.html`
- Commandes admin via `Start-Process -Verb RunAs` (UAC Windows)

---

## Stack

`Electron 28` · `Vanilla JS` · `electron-builder 25` · `NSIS` · `Windows x64`
