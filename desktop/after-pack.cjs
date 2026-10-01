// Hook de electron-builder: en Linux envuelve el ejecutable con un pequeño
// script (ver linux-sandbox.cjs) para que el AppImage arranque en Ubuntu 24.04+.
const fs = require("node:fs");
const path = require("node:path");
const { wrapperScript } = require("./linux-sandbox.cjs");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "linux") return;
  const exe = path.join(context.appOutDir, context.packager.executableName);
  const bin = `${exe}.bin`;
  fs.renameSync(exe, bin);
  fs.writeFileSync(exe, wrapperScript(path.basename(bin)), { mode: 0o755 });
};
