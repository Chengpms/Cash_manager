@echo off
chcp 65001 >nul
cd /d "%~dp0"

REM Gestor de Dinero - instala lo necesario (solo la primera vez) y abre la app de escritorio.
REM Para instalarla de forma permanente es mas comodo usar el instalador .exe (ver README).

echo == Gestor de Dinero ==

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js no esta instalado. Instalalo desde https://nodejs.org ^(version 18 o superior^) y vuelve a ejecutar este script.
  pause
  exit /b 1
)

if not exist "frontend\node_modules" (
  echo -^> Instalando dependencias de la app...
  call npm install --prefix frontend
  if errorlevel 1 goto :error
)

if not exist "desktop\node_modules" (
  echo -^> Instalando Electron ^(escritorio^)...
  call npm install --prefix desktop
  if errorlevel 1 goto :error
)

echo -^> Compilando y abriendo la app...
call npm run desktop
if errorlevel 1 goto :error
goto :eof

:error
echo.
echo Hubo un error. Revisa el mensaje de arriba.
pause
exit /b 1
