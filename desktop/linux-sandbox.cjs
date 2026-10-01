// Ubuntu 24.04+ bloquea con AppArmor los "user namespaces" sin privilegios, y
// entonces Chromium no puede arrancar su sandbox salvo que el helper
// chrome-sandbox sea setuid root (lo es al instalar el .deb, pero no en el
// AppImage ni en desarrollo). Estas utilidades detectan ese caso para lanzar
// con --no-sandbox solo cuando es imprescindible.
const fs = require("node:fs");
const path = require("node:path");

function needsNoSandbox(electronDir) {
  if (process.platform !== "linux") return false;
  try {
    const restricted = fs.readFileSync("/proc/sys/kernel/apparmor_restrict_unprivileged_userns", "utf-8").trim();
    if (restricted !== "1") return false;
  } catch {
    return false;
  }
  try {
    const st = fs.statSync(path.join(electronDir, "chrome-sandbox"));
    const setuidRoot = st.uid === 0 && (st.mode & 0o4000) !== 0;
    return !setuidRoot;
  } catch {
    return true;
  }
}

// Script que sustituye al ejecutable en el paquete de Linux
function wrapperScript(binName) {
  return `#!/bin/sh
# Lanzador de Gestor de Dinero: añade --no-sandbox solo si el sistema bloquea
# los user namespaces y el helper chrome-sandbox no está instalado con setuid.
HERE="$(dirname "$(readlink -f "$0")")"
if [ "$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null)" = "1" ] && [ ! -u "$HERE/chrome-sandbox" ]; then
  exec "$HERE/${binName}" --no-sandbox "$@"
fi
exec "$HERE/${binName}" "$@"
`;
}

module.exports = { needsNoSandbox, wrapperScript };
