import { loadBackupRaw, loadRaw, saveRaw } from "./storage";

// Base de datos local de la app: un documento JSON con todas las tablas que se
// carga en memoria al arrancar y se guarda entero tras cada cambio. Para el
// volumen de datos de una persona (miles de movimientos) es instantáneo y
// funciona igual en escritorio, Android y navegador.

export const DB_VERSION = 2;

export const ACCOUNT_TYPES = ["checking", "savings", "cash", "credit", "investment"] as const;
export const MOVEMENT_TYPES = ["income", "expense"] as const;

export interface AccountRow {
  id: string;
  name: string;
  type: (typeof ACCOUNT_TYPES)[number];
  currency: string;
  color: string;
  icon: string;
  initialBalance: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryRow {
  id: string;
  name: string;
  type: (typeof MOVEMENT_TYPES)[number];
  color: string;
  icon: string;
  // Presupuesto mensual (solo categorías de gasto). null = sin presupuesto.
  budget: number | null;
  createdAt: string;
}

export interface TransactionRow {
  id: string;
  amount: number;
  type: (typeof MOVEMENT_TYPES)[number];
  description: string | null;
  date: string;
  createdAt: string;
  accountId: string;
  categoryId: string | null;
}

export interface TransferRow {
  id: string;
  amount: number;
  description: string | null;
  date: string;
  createdAt: string;
  fromAccountId: string;
  toAccountId: string;
}

export interface GoogleState {
  // "oauth": escritorio, con refresh token. "android": token de acceso que se
  // renueva pidiéndoselo de nuevo a Google Play Services (sin refresh token).
  authMode: "oauth" | "android";
  email: string;
  accessToken: string;
  refreshToken: string;
  expiryDate: number | null;
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  lastSyncedAt: string | null;
  // Hay cambios locales que aún no se han subido a la hoja.
  pendingPush: boolean;
  // IDs que había en la hoja tras la última sincronización: solo esas filas
  // pueden borrarse en la app al importar (nunca lo que aún no se subió).
  knownIds: string[];
}

export interface Settings {
  googleClientId: string;
  googleClientSecret: string;
}

export interface Database {
  version: number;
  // Se incrementa con cada cambio en los datos (para saber si algo cambió
  // mientras se sincronizaba con Google).
  revision: number;
  accounts: AccountRow[];
  categories: CategoryRow[];
  transactions: TransactionRow[];
  transfers: TransferRow[];
  google: GoogleState | null;
  settings: Settings;
}

export function emptyDatabase(): Database {
  return {
    version: DB_VERSION,
    revision: 0,
    accounts: [],
    categories: [],
    transactions: [],
    transfers: [],
    google: null,
    settings: { googleClientId: "", googleClientSecret: "" },
  };
}

export function genId(): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 16);
  return `c${Date.now().toString(36)}${rand}`;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------- Validación / normalización ----------
// Todo lo que entra en la base de datos desde disco o desde una copia de
// seguridad pasa por aquí: se corrigen valores ausentes y se descartan filas
// inválidas o que apuntan a cuentas inexistentes, en vez de romper la app.

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function isoDate(v: unknown, fallback?: string): string | null {
  if (typeof v !== "string" && typeof v !== "number") return fallback ?? null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? fallback ?? null : d.toISOString();
}

function oneOf<T extends string>(v: unknown, options: readonly T[]): T | null {
  return options.includes(v as T) ? (v as T) : null;
}

function arr(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : [];
}

// Código de divisa ISO de 3 letras que Intl entienda; si no, EUR.
export function validCurrency(v: unknown): string {
  const code = str(v).trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return "EUR";
  try {
    new Intl.NumberFormat("es-ES", { style: "currency", currency: code });
    return code;
  } catch {
    return "EUR";
  }
}

export interface NormalizeReport {
  dropped: number;
}

export function normalizeDatabase(raw: unknown, report: NormalizeReport = { dropped: 0 }): Database {
  if (!raw || typeof raw !== "object") throw new Error("El archivo no contiene datos válidos de Gestor de Dinero");
  const src = raw as Record<string, unknown>;
  if (!Array.isArray(src.accounts) && !Array.isArray(src.transactions)) {
    throw new Error("El archivo no contiene datos válidos de Gestor de Dinero");
  }
  const now = new Date().toISOString();
  const db = emptyDatabase();
  const seen = new Set<string>();
  const uniqueId = (v: unknown) => {
    const id = str(v).trim();
    if (!id || seen.has(id)) return null;
    seen.add(id);
    return id;
  };

  for (const a of arr(src.accounts)) {
    const id = uniqueId(a.id);
    const type = oneOf(a.type, ACCOUNT_TYPES) ?? "checking";
    const name = str(a.name).trim();
    if (!id || !name) {
      report.dropped++;
      continue;
    }
    const createdAt = isoDate(a.createdAt, now)!;
    db.accounts.push({
      id,
      name,
      type,
      currency: validCurrency(a.currency),
      color: str(a.color, "#E8703A") || "#E8703A",
      icon: str(a.icon, "wallet") || "wallet",
      initialBalance: num(a.initialBalance) ?? 0,
      archived: a.archived === true,
      createdAt,
      updatedAt: isoDate(a.updatedAt, createdAt)!,
    });
  }
  const accountIds = new Set(db.accounts.map((a) => a.id));

  for (const c of arr(src.categories)) {
    const id = uniqueId(c.id);
    const type = oneOf(c.type, MOVEMENT_TYPES);
    const name = str(c.name).trim();
    if (!id || !type || !name) {
      report.dropped++;
      continue;
    }
    const budget = num(c.budget);
    db.categories.push({
      id,
      name,
      type,
      color: str(c.color, "#8A7A6D") || "#8A7A6D",
      icon: str(c.icon, "tag") || "tag",
      budget: type === "expense" && budget !== null && budget > 0 ? round2(budget) : null,
      createdAt: isoDate(c.createdAt, now)!,
    });
  }
  const categoryIds = new Set(db.categories.map((c) => c.id));

  for (const t of arr(src.transactions)) {
    const id = uniqueId(t.id);
    const type = oneOf(t.type, MOVEMENT_TYPES);
    const amount = num(t.amount);
    const date = isoDate(t.date);
    const accountId = str(t.accountId);
    if (!id || !type || amount === null || amount <= 0 || !date || !accountIds.has(accountId)) {
      report.dropped++;
      continue;
    }
    const categoryId = str(t.categoryId);
    db.transactions.push({
      id,
      amount: round2(amount),
      type,
      description: str(t.description).trim() || null,
      date,
      createdAt: isoDate(t.createdAt, now)!,
      accountId,
      categoryId: categoryIds.has(categoryId) ? categoryId : null,
    });
  }

  for (const t of arr(src.transfers)) {
    const id = uniqueId(t.id);
    const amount = num(t.amount);
    const date = isoDate(t.date);
    const fromAccountId = str(t.fromAccountId);
    const toAccountId = str(t.toAccountId);
    if (
      !id ||
      amount === null ||
      amount <= 0 ||
      !date ||
      !accountIds.has(fromAccountId) ||
      !accountIds.has(toAccountId) ||
      fromAccountId === toAccountId
    ) {
      report.dropped++;
      continue;
    }
    db.transfers.push({
      id,
      amount: round2(amount),
      description: str(t.description).trim() || null,
      date,
      createdAt: isoDate(t.createdAt, now)!,
      fromAccountId,
      toAccountId,
    });
  }

  const g = src.google as Record<string, unknown> | null | undefined;
  const authMode = g && typeof g === "object" && g.authMode === "android" ? "android" : "oauth";
  if (g && typeof g === "object" && (str(g.refreshToken) || authMode === "android")) {
    db.google = {
      authMode,
      email: str(g.email, "cuenta-google"),
      accessToken: str(g.accessToken),
      refreshToken: str(g.refreshToken),
      expiryDate: num(g.expiryDate),
      spreadsheetId: str(g.spreadsheetId) || null,
      spreadsheetUrl: str(g.spreadsheetUrl) || null,
      lastSyncedAt: isoDate(g.lastSyncedAt),
      pendingPush: g.pendingPush === true,
      knownIds: Array.isArray(g.knownIds) ? g.knownIds.filter((x): x is string => typeof x === "string") : [],
    };
  }

  const s = (src.settings || {}) as Record<string, unknown>;
  db.settings = {
    googleClientId: str(s.googleClientId).trim(),
    googleClientSecret: str(s.googleClientSecret).trim(),
  };

  db.revision = num(src.revision) ?? 0;
  return db;
}

// ---------- Carga y guardado ----------

let current: Database | null = null;
let loading: Promise<Database> | null = null;
let writeChain: Promise<unknown> = Promise.resolve();

// Aviso para mostrar en la interfaz si hubo que recuperar los datos de la copia.
export let loadWarning: string | null = null;

async function loadFromStorage(): Promise<Database> {
  const raw = await loadRaw();
  if (!raw) return emptyDatabase();
  try {
    return normalizeDatabase(JSON.parse(raw));
  } catch (err) {
    console.error("Datos principales dañados, intentando la copia de seguridad", err);
    const backup = await loadBackupRaw();
    if (backup) {
      try {
        const db = normalizeDatabase(JSON.parse(backup));
        loadWarning =
          "Los datos guardados estaban dañados y se han recuperado desde la copia automática anterior.";
        return db;
      } catch {
        // seguimos al error final
      }
    }
    // No sobrescribimos nada: lanzamos el error para que la interfaz lo muestre
    // y el archivo original siga intacto para poder recuperarlo a mano.
    throw new Error("No se pudieron leer los datos guardados (el archivo está dañado).");
  }
}

export function getDb(): Promise<Database> {
  if (current) return Promise.resolve(current);
  if (!loading) {
    loading = loadFromStorage()
      .then((db) => (current = db))
      .catch((err) => {
        loading = null;
        throw err;
      });
  }
  return loading;
}

// Aplica un cambio de forma transaccional: se trabaja sobre una copia, y solo
// si la función termina bien y el guardado en disco tiene éxito pasa a ser el
// estado actual. Los cambios se encolan para que nunca se pisen entre sí.
export function mutate<T>(fn: (db: Database) => T, opts: { touchesData?: boolean } = {}): Promise<T> {
  const run = writeChain.then(async () => {
    const base = await getDb();
    const draft: Database = JSON.parse(JSON.stringify(base));
    const result = fn(draft);
    if (opts.touchesData !== false) {
      draft.revision++;
      if (draft.google) draft.google.pendingPush = true;
    }
    await saveRaw(JSON.stringify(draft));
    current = draft;
    return result;
  });
  writeChain = run.catch(() => undefined);
  return run;
}

// Sustituye los datos (restaurar copia de seguridad). La conexión con Google y
// los ajustes del dispositivo se conservan.
export function replaceData(next: Database): Promise<void> {
  return mutate((db) => {
    db.accounts = next.accounts;
    db.categories = next.categories;
    db.transactions = next.transactions;
    db.transfers = next.transfers;
  });
}
