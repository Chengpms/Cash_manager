// Proceso principal de la versión de escritorio (Linux / Windows).
// Carga la app web compilada y le da acceso, a través de preload.cjs, a:
//  - un archivo de datos en la carpeta del usuario (con escritura atómica,
//    copia .bak y copias diarias automáticas),
//  - el inicio de sesión con Google (OAuth con PKCE en el navegador del sistema),
//  - peticiones HTTP a las APIs de Google (sin problemas de CORS),
//  - diálogos para guardar archivos.

const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const crypto = require("node:crypto");

const DATA_FILE = "gestor-data.json";
const DAILY_BACKUPS_TO_KEEP = 14;
const GOOGLE_REDIRECT_PORT = 4000;
const GOOGLE_REDIRECT_PATH = "/api/google/callback";
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

// Datos portables: si existe una carpeta "gestor-data" junto al ejecutable
// (p. ej. en un USB), los datos se guardan ahí en vez de en la carpeta del usuario.
function resolveDataDir() {
  if (process.env.GESTOR_DATA_DIR) return path.resolve(process.env.GESTOR_DATA_DIR);
  // Windows portable -> carpeta del .exe; AppImage -> carpeta del .AppImage
  const exeDir =
    process.env.PORTABLE_EXECUTABLE_DIR ||
    (process.env.APPIMAGE && path.dirname(process.env.APPIMAGE)) ||
    path.dirname(process.execPath);
  const portable = path.join(exeDir, "gestor-data");
  if (app.isPackaged && fs.existsSync(portable)) return portable;
  return app.getPath("userData");
}

let dataDir;
let mainWindow = null;

// ---------- Archivo de datos ----------

function dataPath() {
  return path.join(dataDir, DATA_FILE);
}

function readJsonFile(file) {
  try {
    const text = fs.readFileSync(file, "utf-8");
    JSON.parse(text); // valida
    return text;
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

function loadData() {
  const main = dataPath();
  try {
    return readJsonFile(main);
  } catch (err) {
    // Archivo dañado: lo apartamos (sin borrarlo) y recurrimos a la copia .bak
    console.error("Archivo de datos dañado:", err);
    const corrupt = `${main}.corrupt-${Date.now()}`;
    try {
      fs.renameSync(main, corrupt);
    } catch {
      // ignorar
    }
    const backup = readJsonFile(`${main}.bak`);
    if (backup !== null) return backup;
    throw new Error(`El archivo de datos está dañado y no hay copia. Se ha guardado aparte como ${corrupt}`);
  }
}

function dailyBackup(currentText) {
  const dir = path.join(dataDir, "copias");
  fs.mkdirSync(dir, { recursive: true });
  const d = new Date();
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const file = path.join(dir, `gestor-${day}.json`);
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, currentText);
    const old = fs
      .readdirSync(dir)
      .filter((f) => /^gestor-\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort()
      .slice(0, -DAILY_BACKUPS_TO_KEEP);
    for (const f of old) fs.rmSync(path.join(dir, f), { force: true });
  }
}

function saveData(json) {
  if (typeof json !== "string") throw new Error("Datos no válidos");
  JSON.parse(json); // nunca escribimos algo que no se pueda volver a leer
  fs.mkdirSync(dataDir, { recursive: true });
  const main = dataPath();
  const tmp = `${main}.tmp`;

  // 1) Escribir en un archivo temporal y forzarlo a disco
  const fd = fs.openSync(tmp, "w");
  try {
    fs.writeSync(fd, json);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  // 2) La versión anterior pasa a ser la copia .bak (y la copia del día)
  if (fs.existsSync(main)) {
    const previous = fs.readFileSync(main, "utf-8");
    fs.writeFileSync(`${main}.bak`, previous);
    try {
      dailyBackup(previous);
    } catch (err) {
      console.error("No se pudo crear la copia diaria:", err);
    }
  }
  // 3) Sustituir de forma atómica
  fs.renameSync(tmp, main);
}

// ---------- Google OAuth (navegador del sistema + servidor local temporal) ----------

function base64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let pendingSignIn = null;

function googleSignIn({ clientId }) {
  if (typeof clientId !== "string" || !clientId) throw new Error("Falta el Client ID de Google");
  if (pendingSignIn) pendingSignIn.cancel("Se inició un nuevo intento de conexión");

  const codeVerifier = base64url(crypto.randomBytes(48));
  const challenge = base64url(crypto.createHash("sha256").update(codeVerifier).digest());
  const state = base64url(crypto.randomBytes(16));
  const redirectUri = `http://localhost:${GOOGLE_REDIRECT_PORT}${GOOGLE_REDIRECT_PATH}`;

  return new Promise((resolve, reject) => {
    const servers = [];
    let finished = false;
    const finish = (err, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      pendingSignIn = null;
      for (const s of servers) s.close();
      if (err) reject(err);
      else resolve(value);
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    };

    const page = (title, text) =>
      `<!doctype html><meta charset="utf-8"><title>${title}</title>` +
      `<body style="font-family:system-ui;background:#F6F0E4;color:#2B1B12;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">` +
      `<div style="text-align:center"><h2>${title}</h2><p>${text}</p></div></body>`;

    const handler = (req, res) => {
      const url = new URL(req.url, redirectUri);
      if (url.pathname !== GOOGLE_REDIRECT_PATH) {
        res.writeHead(404).end();
        return;
      }
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      if (error || !code || url.searchParams.get("state") !== state) {
        res.end(page("No se pudo conectar", "Puedes cerrar esta pestaña y volver a Gestor de Dinero."));
        finish(new Error(error === "access_denied" ? "Has cancelado el acceso a Google" : "Google no completó la conexión"));
        return;
      }
      res.end(page("¡Conectado!", "Ya puedes cerrar esta pestaña y volver a Gestor de Dinero."));
      finish(null, { code, redirectUri, codeVerifier });
    };

    // "localhost" puede resolverse a IPv4 o IPv6 según el sistema: escuchamos en ambos
    let listening = 0;
    let failures = 0;
    for (const host of ["127.0.0.1", "::1"]) {
      const server = http.createServer(handler);
      servers.push(server);
      server.on("error", (err) => {
        failures++;
        if (failures === 2 || (err.code === "EADDRINUSE" && host === "127.0.0.1")) {
          finish(
            new Error(
              err.code === "EADDRINUSE"
                ? `El puerto ${GOOGLE_REDIRECT_PORT} está ocupado por otro programa. Ciérralo y vuelve a intentarlo.`
                : `No se pudo preparar la conexión con Google: ${err.message}`
            )
          );
        }
      });
      server.listen(GOOGLE_REDIRECT_PORT, host, () => {
        listening++;
        if (listening === 1) {
          const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
          auth.search = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: "code",
            scope: GOOGLE_SCOPES.join(" "),
            access_type: "offline",
            prompt: "consent",
            state,
            code_challenge: challenge,
            code_challenge_method: "S256",
          }).toString();
          shell.openExternal(auth.toString());
        }
      });
    }

    const timer = setTimeout(
      () => finish(new Error("Se agotó el tiempo de espera para conectar con Google")),
      5 * 60 * 1000
    );
    pendingSignIn = { cancel: (msg) => finish(new Error(msg)) };
  });
}

// Solo se permiten peticiones HTTPS a dominios de Google
function isAllowedGoogleUrl(raw) {
  try {
    const url = new URL(raw);
    return (
      url.protocol === "https:" &&
      (url.hostname === "googleapis.com" || url.hostname.endsWith(".googleapis.com"))
    );
  } catch {
    return false;
  }
}

async function googleFetch(req) {
  if (!req || !isAllowedGoogleUrl(req.url)) throw new Error("URL no permitida");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(req.url, {
      method: req.method || "GET",
      headers: req.headers || {},
      body: req.body,
      signal: controller.signal,
    });
    return { status: res.status, body: await res.text() };
  } catch (err) {
    throw new Error(err.name === "AbortError" ? "Google no respondió a tiempo" : err.message);
  } finally {
    clearTimeout(timeout);
  }
}

function isSafeExternalUrl(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:";
  } catch {
    return false;
  }
}

// ---------- Ventana ----------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 380,
    minHeight: 560,
    backgroundColor: "#F6F0E4",
    title: "Gestor de Dinero",
    icon: path.join(__dirname, "build", "icon.png"),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  // Los enlaces externos se abren en el navegador del sistema, nunca dentro de la app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const current = mainWindow.webContents.getURL();
    if (url.split("#")[0] !== current.split("#")[0]) {
      event.preventDefault();
      if (isSafeExternalUrl(url)) shell.openExternal(url);
    }
  });

  const devUrl = process.env.GESTOR_DEV_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "app", "index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function handle(channel, fn) {
  ipcMain.handle(channel, async (_event, ...args) => fn(...args));
}

// Una única instancia: si se abre otra vez, se enfoca la ventana existente
// (dos instancias escribiendo el mismo archivo podrían pisarse los datos).
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    dataDir = resolveDataDir();
    if (process.platform !== "darwin") Menu.setApplicationMenu(null);

    handle("data:load", () => loadData());
    handle("data:save", (json) => saveData(json));
    handle("data:path", () => dataPath());
    handle("google:signIn", (opts) => googleSignIn(opts || {}));
    handle("google:fetch", (req) => googleFetch(req));
    handle("shell:openExternal", (url) => {
      if (isSafeExternalUrl(url)) return shell.openExternal(url);
    });
    handle("file:save", async ({ defaultName, content }) => {
      if (typeof content !== "string") throw new Error("Contenido no válido");
      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: path.join(app.getPath("documents"), path.basename(String(defaultName || "archivo.txt"))),
      });
      if (result.canceled || !result.filePath) return null;
      fs.writeFileSync(result.filePath, content, "utf-8");
      return result.filePath;
    });

    createWindow();
  });

  app.on("window-all-closed", () => {
    app.quit();
  });
}
