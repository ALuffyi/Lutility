@echo off
title LUTILITY — Build Installeur
setlocal
cd /d "%~dp0"

echo.
echo  ============================================
echo   LUTILITY — Build installeur .exe
echo  ============================================
echo.

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo  [ERREUR] Node.js introuvable. Installez depuis https://nodejs.org
    pause & exit /b 1
)
for /f %%v in ('node --version') do echo  Node.js : %%v

:: Branche + version courante
for /f "tokens=*" %%b in ('git branch --show-current 2^>nul') do set BRANCH=%%b
for /f "tokens=2 delims=:, " %%v in ('findstr "\"version\"" package.json') do set VER=%%v
echo  Branche  : %BRANCH%
echo  Version  : %VER%
echo.

:: Confirmation si on est sur dev
if /i "%BRANCH%"=="dev" (
    echo  [AVERTISSEMENT] Tu es sur la branche DEV.
    echo  Appuie sur une touche pour continuer ou ferme la fenetre pour annuler.
    pause >nul
    echo.
)

echo  [1/2] npm install...
call npm install
if errorlevel 1 ( echo  [ERREUR] npm install a echoue & pause & exit /b 1 )

echo.
echo  [2/2] Build installeur NSIS...
set CSC_IDENTITY_AUTO_DISCOVERY=false
call npx electron-builder --win --x64
if errorlevel 1 ( echo  [ERREUR] Build echoue & pause & exit /b 1 )

:: Trouver le .exe generé
for %%f in ("dist\Lutility-Setup-*.exe") do set OUTFILE=%%f

echo.
echo  ============================================
echo   BUILD REUSSI !
echo   Installeur : %OUTFILE%
echo  ============================================
echo.
pause
