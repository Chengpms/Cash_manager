#!/usr/bin/env bash
# Gestor de Dinero — instala lo necesario (solo la primera vez) y abre la app de escritorio.
# Para instalarla de forma permanente es más cómodo usar el AppImage / .deb (ver README).
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "== Gestor de Dinero =="

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js no está instalado. Instálalo desde https://nodejs.org (versión 18 o superior) y vuelve a ejecutar este script."
  exit 1
fi

if [ ! -d frontend/node_modules ]; then
  echo "-> Instalando dependencias de la app..."
  npm install --prefix frontend
fi

if [ ! -d desktop/node_modules ]; then
  echo "-> Instalando Electron (escritorio)..."
  npm install --prefix desktop
fi

echo "-> Compilando y abriendo la app..."
npm run desktop
