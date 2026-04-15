@echo off
title LUTILITY - Dev Mode
cd /d "%~dp0"

node --version >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Node.js introuvable
    pause & exit /b 1
)

if not exist "node_modules" (
    echo Installation des dependances...
    call npm install
)

for /f "tokens=*" %%b in ('git branch --show-current 2^>nul') do set BRANCH=%%b
for /f "tokens=2 delims=:, " %%v in ('findstr "\"version\"" package.json') do set VER=%%v

echo.
echo  Branche : %BRANCH%
echo  Version : %VER%
echo.
echo  [1] Dev       isDev=true   config.dev
echo  [2] User sim  isDev=false  config
echo  [3] Les deux cote a cote
echo.
set /p CHOICE="Choix [1/2/3] (defaut: 1) : "
if "%CHOICE%"=="" set CHOICE=1

if "%CHOICE%"=="1" goto DEV
if "%CHOICE%"=="2" goto USERSIM
if "%CHOICE%"=="3" goto BOTH

:DEV
echo Lancement mode DEV...
npx electron .
goto END

:USERSIM
echo Lancement mode SIMULATION UTILISATEUR...
npx electron . --user-sim
goto END

:BOTH
echo Lancement des deux instances...
start "LUTILITY - Dev" cmd /k "cd /d "%~dp0" && npx electron ."
timeout /t 2 /nobreak >nul
start "LUTILITY - User Sim" cmd /k "cd /d "%~dp0" && npx electron . --user-sim"

:END
