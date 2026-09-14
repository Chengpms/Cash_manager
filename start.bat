@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo == Gestor de Dinero ==

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js no esta instalado. Instalalo desde https://nodejs.org ^(version 18 o superior^) y vuelve a ejecutar este script.
  pause
  exit /b 1
)

REM 1. Variables de entorno del backend
if not exist "backend\.env" (
  copy "backend\.env.example" "backend\.env" >nul
  echo -^> Creado backend\.env
)

REM 2. Dependencias (se instalan solo si falta la carpeta node_modules correspondiente).
REM    Si alguna vez añades una dependencia nueva al proyecto, borra la carpeta
REM    node_modules correspondiente y vuelve a ejecutar este script.
if not exist "node_modules" (
  echo -^> Instalando dependencias raiz...
  call npm install
  if errorlevel 1 goto :error
)

if not exist "backend\node_modules" (
  echo -^> Instalando dependencias del backend...
  call npm install --prefix backend
  if errorlevel 1 goto :error
)

if not exist "frontend\node_modules" (
  echo -^> Instalando dependencias del frontend...
  call npm install --prefix frontend
  if errorlevel 1 goto :error
)

REM 3. Base de datos: crear la migracion inicial, o aplicar migraciones nuevas si ya existia
if not exist "backend\prisma\migrations" (
  echo -^> Creando la base de datos ^(primera vez^)...
  pushd backend
  call npx prisma migrate dev --name init
  popd
) else (
  pushd backend
  call npx prisma migrate dev
  popd
)

REM 4. Arrancar backend (puerto 4000) y frontend (puerto 5173) a la vez
echo -^> Arrancando la app en http://localhost:5173 ^(Ctrl+C para detener^)
call npm run dev
pause
goto :eof

:error
echo.
echo Hubo un error instalando las dependencias. Revisa el mensaje de arriba.
pause
exit /b 1
