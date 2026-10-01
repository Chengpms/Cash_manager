// Copia la app web compilada (frontend/dist) dentro de desktop/app para empaquetarla.
const fs = require("node:fs");
const path = require("node:path");

const src = path.join(__dirname, "..", "frontend", "dist");
const dest = path.join(__dirname, "app");

if (!fs.existsSync(path.join(src, "index.html"))) {
  console.error("No existe frontend/dist. Ejecuta antes: npm run build --prefix frontend");
  process.exit(1);
}
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log("App web copiada a desktop/app");
