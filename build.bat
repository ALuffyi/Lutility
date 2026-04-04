@echo off
title LUTILITY — Build .exe
setlocal
cd /d "%~dp0"

echo.
echo  ============================================
echo   LUTILITY Builder
echo  ============================================
echo.

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo  [ERREUR] Node.js introuvable. Installez depuis https://nodejs.org
    pause & exit /b 1
)
for /f %%v in ('node --version') do echo  Node.js : %%v

echo.
echo  [1/3] npm install...
call npm install
if errorlevel 1 (
    echo  [ERREUR] npm install a echoue
    pause & exit /b 1
)

echo.
echo  [2/3] Build portable (sans Admin requis)...
call npm run build
if errorlevel 1 (
    echo  [ERREUR] Build echoue
    pause & exit /b 1
)

echo.
echo  [3/3] Creation du ZIP distribuable...
powershell -NoProfile -Command ^
  "Compress-Archive -Path 'dist-pack\Lutility-win32-x64\*' -DestinationPath 'dist-pack\Lutility.zip' -Force"
if errorlevel 1 (
    echo  [INFO] ZIP non cree ^(PowerShell indisponible^), le dossier reste dans dist-pack\Lutility-win32-x64\
) else (
    echo  ZIP cree : dist-pack\Lutility.zip
)

echo.
echo  ============================================
echo   BUILD REUSSI !
echo   - Portable  : dist-pack\Lutility-win32-x64\Lutility.exe
echo   - Archive   : dist-pack\Lutility.zip
echo  ============================================
echo.
echo  Note : pour obtenir un installeur .exe avec menu Demarrer,
echo  activez le Mode Developpeur Windows et lancez : npm run build-installer
echo.
pause
