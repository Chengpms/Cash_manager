import { desktop } from "./platform";

// Persistencia del archivo de datos (un único JSON):
// - Escritorio (Electron): archivo en la carpeta de datos del usuario, con
//   escritura atómica y copia de seguridad gestionadas por el proceso principal.
// - Android / navegador: IndexedDB dentro de la propia app.

const IDB_NAME = "gestor-dinero";
const IDB_STORE = "kv";
const IDB_KEY = "data";

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function loadRaw(): Promise<string | null> {
  if (desktop) return desktop.loadData();
  return idbGet(IDB_KEY);
}

export async function saveRaw(json: string): Promise<void> {
  if (desktop) return desktop.saveData(json);
  // Guardamos también la versión anterior para poder recuperarla si la nueva
  // quedase dañada por algún motivo.
  const previous = await idbGet(IDB_KEY);
  if (previous) await idbSet(`${IDB_KEY}.bak`, previous);
  await idbSet(IDB_KEY, json);
}

export async function loadBackupRaw(): Promise<string | null> {
  if (desktop) return null; // el proceso principal ya recurre a la copia .bak
  return idbGet(`${IDB_KEY}.bak`);
}

export async function requestPersistentStorage() {
  try {
    if (!desktop && navigator.storage?.persist) await navigator.storage.persist();
  } catch {
    // No es crítico: solo reduce la probabilidad de que el sistema libere el espacio.
  }
}
