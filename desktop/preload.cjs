// Puente seguro entre la app web y el proceso principal: solo expone estas
// funciones concretas (ver frontend/src/data/platform.ts).
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gestorDesktop", {
  loadData: () => ipcRenderer.invoke("data:load"),
  saveData: (json) => ipcRenderer.invoke("data:save", json),
  dataPath: () => ipcRenderer.invoke("data:path"),
  googleSignIn: (opts) => ipcRenderer.invoke("google:signIn", opts),
  googleFetch: (req) => ipcRenderer.invoke("google:fetch", req),
  openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),
  saveFile: (opts) => ipcRenderer.invoke("file:save", opts),
});
