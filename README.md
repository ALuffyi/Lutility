# LUTILITY — Electron

## ▶ Lancer sans builder (développement / test)

Double-clic sur **`run.bat`**

→ Installe les dépendances si besoin, puis lance l'app directement.
→ Aucun .exe généré — l'app tourne via Node.js/Electron en local.

## 📦 Générer le .exe définitif (distribution)

Double-clic sur **`build.bat`**

→ Génère `dist/Lutility Setup 2.0.0.exe`
→ Faire une seule fois quand l'app est stable.

## Structure

```
Lutility-electron/
├── run.bat          ← Lancer directement (test)
├── build.bat        ← Générer le .exe
├── main.js          ← Process Electron (Node.js)
├── preload.js       ← Pont sécurisé IPC
├── renderer.html    ← Interface HTML
├── css/style.css
└── js/
    ├── state.js     ← Données globales S, constantes
    ├── launch.js    ← Écran de démarrage / wizard
    ├── persist.js   ← Lecture/écriture fichiers via IPC
    ├── app.js       ← Nav, modals, horloge
    ├── jeux.js      ← Menu Jeux
    ├── notes.js     ← Menu Notes
    └── tools.js     ← Menu Tools (exécutable)
```

## Données sauvegardées

- **Config** (profil + dossier) : `%AppData%\Lutility\config.json`
- **Données** : dans le dossier `Lutility_SAV\` choisi au 1er lancement
