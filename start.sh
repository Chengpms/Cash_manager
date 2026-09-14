#!/usr/bin/env bash
# Gestor de Dinero — instalación y arranque en un solo paso
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "== Gestor de Dinero =="

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js no está instalado. Instálalo desde https://nodejs.org (versión 18 o superior) y vuelve a ejecutar este script."
  exit 1
fi

# 1. Variables de entorno del backend
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  echo "-> Creado backend/.env"
fi

# 2. Dependencias (solo si no están instaladas ya)
if [ ! -d node_modules ]; then
  echo "-> Instalando dependencias raíz..."
  npm install
fi

if [ ! -d backend/node_modules ]; then
  echo "-> Instalando dependencias del backend..."
  npm install --prefix backend
fi

if [ ! -d frontend/node_modules ]; then
  echo "-> Instalando dependencias del frontend..."
  npm install --prefix frontend
fi

# 3. Base de datos: crear la migración inicial si aún no existe
if [ ! -d backend/prisma/migrations ]; then
  echo "-> Creando la base de datos (primera vez)..."
  (cd backend && npx prisma migrate dev --name init)
fi

# 4. Arrancar backend (puerto 4000) y frontend (puerto 5173) a la vez
echo "-> Arrancando la app en http://localhost:5173 (Ctrl+C para detener)"
npm run dev
