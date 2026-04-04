@echo off
title LUTILITY — Dev Mode
cd /d "%~dp0"

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Node.js introuvable — installez depuis https://nodejs.org
    pause & exit /b 1
)

:: Install deps if node_modules missing
if not exist "node_modules" (
    echo Installation des dependances...
    call npm install
)

:: Launch Electron directly — no build needed
echo Lancement de Lutility...
npx electron .
