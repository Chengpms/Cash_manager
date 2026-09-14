#!/usr/bin/env bash
# Deja la carpeta lista para copiar a un USB: borra las dependencias instaladas
# (node_modules) y las compilaciones (dist), que son grandes, específicas del
# sistema operativo actual y se vuelven a generar solas en cada ordenador la
# primera vez que se ejecuta start.sh / start.bat.
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "== Preparando el proyecto para llevar en USB =="

removed=0
for path in node_modules backend/node_modules frontend/node_modules backend/dist frontend/dist backend/generated; do
  if [ -e "$path" ]; then
    echo "-> Borrando $path"
    rm -rf "$path"
    removed=1
  fi
done

if [ "$removed" -eq 0 ]; then
  echo "-> Ya estaba limpio, no había nada que borrar."
fi

echo ""
echo "Listo. Ya puedes copiar esta carpeta completa a tu memoria USB."
echo "Recuerda: la primera vez que arranques la app en cada ordenador nuevo"
echo "hace falta conexión a internet (para instalar las dependencias)."
