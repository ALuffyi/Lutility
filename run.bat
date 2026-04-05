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

:: Infos branche + version
for /f "tokens=2 delims=: " %%b in ('git branch --show-current 2^>nul') do set BRANCH=%%b
for /f "tokens=*" %%b in ('git branch --show-current 2^>nul') do set BRANCH=%%b
for /f "tokens=2 delims=: " %%v in ('findstr /R "\"version\"" package.json ^| findstr /v "electron\|builder"') do set VER=%%v
for /f "tokens=2 delims=:, " %%v in ('findstr "\"version\"" package.json') do set VER=%%v

echo.
echo  Branche  : %BRANCH%
echo  Version  : %VER%
echo.

echo Lancement de Lutility en mode dev...
npx electron .
