// Arranca la app en modo desarrollo con el Electron local.
const { spawn } = require("node:child_process");
const path = require("node:path");
const electron = require("electron");
const { needsNoSandbox } = require("./linux-sandbox.cjs");

const args = [__dirname];
if (needsNoSandbox(path.dirname(electron))) args.push("--no-sandbox");
const child = spawn(electron, args, { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
