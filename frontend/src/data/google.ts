import type { GoogleImportResult, GoogleStatus, GoogleSyncResult } from "../types";
import { Database, GoogleState, genId, getDb, mutate, validCurrency } from "./db";
import { desktop } from "./platform";
import { computeBalances } from "./service";

// Sincronización con Google Sheets. Toda la comunicación HTTP con Google pasa
// por el proceso principal de Electron (sin CORS ni servidor local), por eso
// esta función solo está disponible en la versión de escritorio.

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const SPREADSHEET_TITLE = "Gestor de Dinero";
const SHEET_NAMES = ["Cuentas", "Categorías", "Transacciones", "Transferencias"];

export const googleAvailable = !!desktop;
export const GOOGLE_SCOPES = SCOPES;

// ---------- HTTP ----------

interface GResponse {
  ok: boolean;
  status: number;
  text: string;
  json<T>(): T;
}

async function gfetch(url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) {
  if (!desktop) throw new Error("La sincronización con Google solo está disponible en la versión de escritorio");
  let res: { status: number; body: string };
  try {
    res = await desktop.googleFetch({ url, ...init });
  } catch (err: any) {
    throw new Error(`Sin conexión con Google: ${err?.message || err}`);
  }
  const out: GResponse = {
    ok: res.status >= 200 && res.status < 300,
    status: res.status,
    text: res.body,
    json<T>() {
      return JSON.parse(res.body) as T;
    },
  };
  return out;
}

function googleError(prefix: string, res: GResponse): Error {
  let detail = res.text;
  try {
    const body = JSON.parse(res.text);
    detail = body.error?.message || body.error_description || body.error || res.text;
  } catch {
    // texto plano
  }
  return new Error(`${prefix} (${res.status}): ${detail}`);
}

// ---------- Credenciales ----------

function getCredentials(db: Database) {
  const clientId = db.settings.googleClientId || (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || "";
  const clientSecret = db.settings.googleClientSecret || (import.meta.env.VITE_GOOGLE_CLIENT_SECRET as string) || "";
  if (!clientId || !clientSecret) {
    throw new Error("Faltan el Client ID y el Client Secret de Google. Rellénalos en Ajustes (ver GOOGLE_SETUP.md).");
  }
  return { clientId, clientSecret };
}

export async function getGoogleCredentials() {
  const db = await getDb();
  return {
    clientId: db.settings.googleClientId,
    clientSecret: db.settings.googleClientSecret,
    hasBuiltIn: !!import.meta.env.VITE_GOOGLE_CLIENT_ID,
  };
}

export async function saveGoogleCredentials(clientId: string, clientSecret: string) {
  await mutate(
    (db) => {
      db.settings.googleClientId = clientId.trim();
      db.settings.googleClientSecret = clientSecret.trim();
    },
    { touchesData: false }
  );
}

// ---------- OAuth ----------

export async function connectGoogle(): Promise<void> {
  if (!desktop) throw new Error("La sincronización con Google solo está disponible en la versión de escritorio");
  const db = await getDb();
  const { clientId, clientSecret } = getCredentials(db);

  const { code, redirectUri, codeVerifier } = await desktop.googleSignIn({ clientId });

  const res = await gfetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }).toString(),
  });
  if (!res.ok) throw googleError("Google rechazó el inicio de sesión", res);
  const tokens = res.json<{ access_token?: string; refresh_token?: string; expires_in?: number }>();
  if (!tokens.access_token) throw new Error("Google no devolvió un token de acceso");

  const info = await gfetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!info.ok) throw googleError("No se pudo obtener el email de la cuenta de Google", info);
  const email = info.json<{ email?: string }>().email || "cuenta-google";

  await mutate(
    (draft) => {
      const existing = draft.google;
      // Google solo envía refresh_token la primera vez que se concede consentimiento
      const refreshToken = tokens.refresh_token || existing?.refreshToken || "";
      if (!refreshToken) {
        throw new Error(
          "Google no envió un refresh token. Revoca el acceso en https://myaccount.google.com/permissions y vuelve a conectar."
        );
      }
      draft.google = {
        email,
        accessToken: tokens.access_token!,
        refreshToken,
        expiryDate: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
        // Si se reconecta la misma cuenta, se sigue usando la misma hoja
        spreadsheetId: existing?.email === email ? existing.spreadsheetId : null,
        spreadsheetUrl: existing?.email === email ? existing.spreadsheetUrl : null,
        lastSyncedAt: existing?.email === email ? existing.lastSyncedAt : null,
        pendingPush: true,
        knownIds: existing?.email === email ? existing.knownIds : [],
      };
    },
    { touchesData: false }
  );
}

async function getValidAccessToken(): Promise<{ accessToken: string; account: GoogleState }> {
  const db = await getDb();
  const account = db.google;
  if (!account) throw new Error("No hay ninguna cuenta de Google conectada");

  if (account.expiryDate && Date.now() < account.expiryDate - 60_000) {
    return { accessToken: account.accessToken, account };
  }

  const { clientId, clientSecret } = getCredentials(db);
  const res = await gfetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: account.refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok) {
    throw googleError("No se pudo renovar el acceso a Google. Vuelve a conectar tu cuenta", res);
  }
  const body = res.json<{ access_token: string; expires_in?: number }>();
  const updated = await mutate(
    (draft) => {
      if (!draft.google) throw new Error("No hay ninguna cuenta de Google conectada");
      draft.google.accessToken = body.access_token;
      draft.google.expiryDate = body.expires_in ? Date.now() + body.expires_in * 1000 : null;
      return draft.google;
    },
    { touchesData: false }
  );
  return { accessToken: body.access_token, account: updated };
}

export async function disconnectGoogle(): Promise<{ disconnected: boolean }> {
  await mutate(
    (db) => {
      db.google = null;
    },
    { touchesData: false }
  );
  return { disconnected: true };
}

export async function getGoogleStatus(): Promise<GoogleStatus> {
  const db = await getDb();
  const g = db.google;
  if (!g) return { connected: false };
  return {
    connected: true,
    email: g.email,
    spreadsheetUrl: g.spreadsheetUrl,
    lastSyncedAt: g.lastSyncedAt,
    pendingPush: g.pendingPush,
  };
}

// ---------- Traducciones Español <-> valores internos ----------

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: "Cuenta corriente",
  savings: "Ahorros",
  cash: "Efectivo",
  credit: "Tarjeta de crédito",
  investment: "Inversión",
};

function labelToAccountType(raw: string) {
  const lower = (raw || "").trim().toLowerCase();
  if (!lower) return null;
  if (lower in ACCOUNT_TYPE_LABELS) return lower as Database["accounts"][number]["type"];
  const entry = Object.entries(ACCOUNT_TYPE_LABELS).find(([, label]) => label.toLowerCase() === lower);
  return entry ? (entry[0] as Database["accounts"][number]["type"]) : null;
}

function movementTypeLabel(type: string) {
  return type === "income" ? "Ingreso" : "Gasto";
}

function labelToMovementType(raw: string): "income" | "expense" | null {
  const lower = (raw || "").trim().toLowerCase();
  if (lower === "ingreso" || lower === "income") return "income";
  if (lower === "gasto" || lower === "expense") return "expense";
  return null;
}

function parseSheetBool(raw: string) {
  const v = (raw || "").trim().toLowerCase();
  return v === "sí" || v === "si" || v === "true" || v === "1" || v === "yes";
}

function parseSheetNumber(raw: string): number | null {
  let cleaned = (raw ?? "").toString().trim().replace(/[€$\s]/g, "");
  if (!cleaned) return null;
  // "1.234,56" (formato español) -> "1234.56"; "1,234.56" -> "1234.56"
  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned =
      cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else {
    cleaned = cleaned.replace(",", ".");
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.round(num * 100) / 100;
}

// Las fechas de los movimientos se guardan como medianoche UTC del día elegido
// (igual que los formularios), así que leemos la hoja en el mismo formato para
// que una fecha no "se mueva" un día al ir y volver.
function parseSheetDate(raw: string): string | null {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;
  let m = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  let y: number, mo: number, d: number;
  if (m) {
    [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else if ((m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {
    [y, mo, d] = [Number(m[3]), Number(m[2]), Number(m[1])];
  } else {
    const fallback = new Date(trimmed);
    if (isNaN(fallback.getTime())) return null;
    [y, mo, d] = [fallback.getFullYear(), fallback.getMonth() + 1, fallback.getDate()];
  }
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (isNaN(date.getTime()) || date.getUTCMonth() !== mo - 1) return null;
  return date.toISOString();
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function normalizeKey(value: string) {
  return (value || "").trim().toLowerCase();
}

// ---------- Lectura / escritura de la hoja ----------

async function createSpreadsheet(accessToken: string) {
  const res = await gfetch(SHEETS_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: { title: SPREADSHEET_TITLE },
      sheets: SHEET_NAMES.map((title) => ({ properties: { title } })),
    }),
  });
  if (!res.ok) throw googleError("No se pudo crear la hoja de cálculo", res);
  return res.json<{ spreadsheetId: string; spreadsheetUrl: string }>();
}

// Comprueba que la hoja sigue existiendo (el usuario pudo borrarla de Drive).
async function spreadsheetExists(accessToken: string, spreadsheetId: string) {
  const res = await gfetch(`${SHEETS_API}/${spreadsheetId}?fields=spreadsheetId`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404) return false;
  if (!res.ok) throw googleError("No se pudo acceder a la hoja de cálculo", res);
  return true;
}

async function writeSheet(accessToken: string, spreadsheetId: string, sheetName: string, rows: (string | number)[][]) {
  const clear = await gfetch(`${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}:clear`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!clear.ok) throw googleError(`No se pudo vaciar la pestaña "${sheetName}"`, clear);
  const range = `${sheetName}!A1`;
  const res = await gfetch(
    `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: rows }),
    }
  );
  if (!res.ok) throw googleError(`No se pudo escribir en la pestaña "${sheetName}"`, res);
}

async function readSheetValues(accessToken: string, spreadsheetId: string, ranges: string[]): Promise<string[][][]> {
  const query = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
  // FORMATTED_VALUE devolvería "1.234,56 €"; UNFORMATTED nos da el número tal cual
  const res = await gfetch(
    `${SHEETS_API}/${spreadsheetId}/values:batchGet?${query}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw googleError("No se pudieron leer los datos de la hoja", res);
  const body = res.json<{ valueRanges: { values?: unknown[][] }[] }>();
  return body.valueRanges.map((r) => (r.values || []).map((row) => row.map((cell) => (cell == null ? "" : String(cell)))));
}

// Asegura que existen las 4 pestañas (por si el usuario borró alguna).
async function ensureTabs(accessToken: string, spreadsheetId: string) {
  const ids = await getSheetIdMap(accessToken, spreadsheetId);
  const missing = SHEET_NAMES.filter((n) => !(n in ids));
  if (missing.length === 0) return;
  const res = await gfetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests: missing.map((title) => ({ addSheet: { properties: { title } } })) }),
  });
  if (!res.ok) throw googleError("No se pudieron crear las pestañas de la hoja", res);
}

function buildRows(db: Database) {
  const balances = computeBalances(db);
  const accountName = new Map(db.accounts.map((a) => [a.id, a.name]));
  const categoryName = new Map(db.categories.map((c) => [c.id, c.name]));
  const byDate = <T extends { date: string }>(a: T, b: T) => b.date.localeCompare(a.date);

  return {
    Cuentas: [
      ["ID", "Nombre", "Tipo", "Divisa", "Balance inicial", "Balance actual", "Archivada"],
      ...[...db.accounts]
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((a) => [
          a.id,
          a.name,
          ACCOUNT_TYPE_LABELS[a.type] || a.type,
          a.currency,
          a.initialBalance,
          balances.get(a.id) ?? a.initialBalance,
          a.archived ? "Sí" : "No",
        ]),
    ],
    "Categorías": [
      ["ID", "Nombre", "Tipo", "Icono", "Color", "Presupuesto mensual"],
      ...[...db.categories]
        .sort((a, b) => a.name.localeCompare(b.name, "es"))
        .map((c) => [c.id, c.name, movementTypeLabel(c.type), c.icon, c.color, c.budget ?? ""]),
    ],
    Transacciones: [
      ["ID", "Fecha", "Tipo", "Importe", "Cuenta", "Categoría", "Descripción"],
      ...[...db.transactions]
        .sort(byDate)
        .map((t) => [
          t.id,
          dayKey(t.date),
          movementTypeLabel(t.type),
          t.amount,
          accountName.get(t.accountId) || "",
          (t.categoryId && categoryName.get(t.categoryId)) || "",
          t.description || "",
        ]),
    ],
    Transferencias: [
      ["ID", "Fecha", "Desde", "Hacia", "Importe", "Descripción"],
      ...[...db.transfers]
        .sort(byDate)
        .map((t) => [
          t.id,
          dayKey(t.date),
          accountName.get(t.fromAccountId) || "",
          accountName.get(t.toAccountId) || "",
          t.amount,
          t.description || "",
        ]),
    ],
  } as Record<string, (string | number)[][]>;
}

function allIds(db: Database) {
  return [
    ...db.accounts.map((x) => x.id),
    ...db.categories.map((x) => x.id),
    ...db.transactions.map((x) => x.id),
    ...db.transfers.map((x) => x.id),
  ];
}

async function pushAllSheets(accessToken: string, spreadsheetId: string, db: Database) {
  await ensureTabs(accessToken, spreadsheetId);
  const rows = buildRows(db);
  for (const name of SHEET_NAMES) {
    await writeSheet(accessToken, spreadsheetId, name, rows[name]);
  }
  await applySheetFormatting(accessToken, spreadsheetId);
}

// ---------- Formato visual de la hoja ----------

async function getSheetIdMap(accessToken: string, spreadsheetId: string): Promise<Record<string, number>> {
  const res = await gfetch(`${SHEETS_API}/${spreadsheetId}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw googleError("No se pudo leer la estructura de la hoja", res);
  const body = res.json<{ sheets: { properties: { sheetId: number; title: string } }[] }>();
  const map: Record<string, number> = {};
  for (const s of body.sheets) map[s.properties.title] = s.properties.sheetId;
  return map;
}

const CURRENCY_FORMAT = { type: "CURRENCY", pattern: '#,##0.00 "€"' };

function repeatCell(sheetId: number, startCol: number, endCol: number, cell: Record<string, unknown>, fields: string, header = false) {
  return {
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: header ? 0 : 1,
        ...(header ? { endRowIndex: 1 } : {}),
        startColumnIndex: startCol,
        endColumnIndex: endCol,
      },
      cell: { userEnteredFormat: cell },
      fields,
    },
  };
}

const SHEET_COLUMN_COUNTS: Record<string, number> = {
  Cuentas: 7,
  "Categorías": 6,
  Transacciones: 7,
  Transferencias: 6,
};

// Columnas [inicio, fin) con importes y con fechas de cada pestaña
const MONEY_COLUMNS: Record<string, [number, number][]> = {
  Cuentas: [[4, 6]],
  "Categorías": [[5, 6]],
  Transacciones: [[3, 4]],
  Transferencias: [[4, 5]],
};
const DATE_COLUMNS: Record<string, [number, number][]> = {
  Transacciones: [[1, 2]],
  Transferencias: [[1, 2]],
};

async function applySheetFormatting(accessToken: string, spreadsheetId: string) {
  try {
    const sheetIds = await getSheetIdMap(accessToken, spreadsheetId);
    const requests: Record<string, unknown>[] = [];
    for (const [name, sheetId] of Object.entries(sheetIds)) {
      const numCols = SHEET_COLUMN_COUNTS[name];
      if (!numCols) continue;
      requests.push(repeatCell(sheetId, 0, numCols, { textFormat: { bold: true } }, "userEnteredFormat.textFormat", true));
      requests.push({
        updateSheetProperties: {
          properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
          fields: "gridProperties.frozenRowCount",
        },
      });
      for (const [s, e] of MONEY_COLUMNS[name] || []) {
        requests.push(
          repeatCell(
            sheetId,
            s,
            e,
            { numberFormat: CURRENCY_FORMAT, horizontalAlignment: "RIGHT" },
            "userEnteredFormat.numberFormat,userEnteredFormat.horizontalAlignment"
          )
        );
      }
      for (const [s, e] of DATE_COLUMNS[name] || []) {
        requests.push(
          repeatCell(
            sheetId,
            s,
            e,
            { numberFormat: { type: "DATE", pattern: "yyyy-mm-dd" }, horizontalAlignment: "CENTER" },
            "userEnteredFormat.numberFormat,userEnteredFormat.horizontalAlignment"
          )
        );
      }
      requests.push({
        autoResizeDimensions: { dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: numCols } },
      });
    }
    if (requests.length === 0) return;
    const res = await gfetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ requests }),
    });
    if (!res.ok) console.error("No se pudo aplicar el formato a la hoja:", res.text);
  } catch (err) {
    // El formato es algo "extra": si falla no interrumpimos la sincronización
    console.error("No se pudo aplicar el formato a la hoja:", err);
  }
}

// ---------- Subir (App -> Sheets) ----------

let syncInFlight: Promise<unknown> | null = null;

// Evita que una subida y una importación se ejecuten a la vez y se pisen.
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = (syncInFlight ?? Promise.resolve()).catch(() => undefined).then(fn);
  syncInFlight = run.finally(() => {
    if (syncInFlight === run) syncInFlight = null;
  });
  return run;
}

export function syncToSheets(): Promise<GoogleSyncResult> {
  return exclusive(async () => {
    const { accessToken, account } = await getValidAccessToken();
    let spreadsheetId = account.spreadsheetId;
    let spreadsheetUrl = account.spreadsheetUrl;

    if (!spreadsheetId || !(await spreadsheetExists(accessToken, spreadsheetId))) {
      const created = await createSpreadsheet(accessToken);
      spreadsheetId = created.spreadsheetId;
      spreadsheetUrl = created.spreadsheetUrl;
    }

    const snapshot = await getDb();
    await pushAllSheets(accessToken, spreadsheetId, snapshot);

    const lastSyncedAt = new Date().toISOString();
    await mutate(
      (db) => {
        if (!db.google) return;
        db.google.spreadsheetId = spreadsheetId;
        db.google.spreadsheetUrl = spreadsheetUrl;
        db.google.lastSyncedAt = lastSyncedAt;
        db.google.knownIds = allIds(snapshot);
        // Si hubo cambios mientras subíamos, se quedan pendientes para la próxima
        if (db.revision === snapshot.revision) db.google.pendingPush = false;
      },
      { touchesData: false }
    );
    return { spreadsheetUrl: spreadsheetUrl!, lastSyncedAt };
  });
}

// ---------- Importar (Sheets -> App) ----------

type Counts = { accounts: number; categories: number; transactions: number; transfers: number };
const zero = (): Counts => ({ accounts: 0, categories: 0, transactions: 0, transfers: 0 });

function applyImport(db: Database, sheets: string[][][], allowDeletes: boolean) {
  const [accountRows, categoryRows, transactionRows, transferRows] = sheets;
  const warnings: string[] = [];
  const created = zero();
  const updated = zero();
  const deleted = zero();
  const now = new Date().toISOString();
  // Solo se borra lo que estaba en la hoja la última vez (nunca lo que aún no se subió)
  const known = new Set(db.google?.knownIds ?? []);
  const canDelete = (id: string) => allowDeletes && known.has(id);

  // ---- Cuentas ----
  const accountsById = new Map(db.accounts.map((a) => [a.id, a]));
  const seenAccounts = new Set<string>();
  const accountNameToId = new Map(db.accounts.filter((a) => !a.archived).map((a) => [normalizeKey(a.name), a.id]));

  for (const row of accountRows.slice(1)) {
    const [id, name, typeLabel, currency, initialRaw, , archivedRaw] = row;
    if (!name || !name.trim()) continue;
    const parsedType = labelToAccountType(typeLabel);
    if (!parsedType) warnings.push(`Cuentas: tipo "${typeLabel}" no reconocido para "${name}", se usó "Cuenta corriente".`);
    if (currency && validCurrency(currency) !== currency.trim().toUpperCase()) {
      warnings.push(`Cuentas: divisa "${currency}" no válida para "${name}", se usó EUR.`);
    }
    const data = {
      name: name.trim(),
      type: parsedType || "checking",
      currency: validCurrency(currency),
      initialBalance: parseSheetNumber(initialRaw) ?? 0,
      archived: parseSheetBool(archivedRaw),
    };
    let finalId = id?.trim();
    const existing = finalId ? accountsById.get(finalId) : undefined;
    if (existing) {
      const changed = (Object.keys(data) as (keyof typeof data)[]).some((k) => existing[k] !== data[k]);
      if (changed) {
        Object.assign(existing, data, { updatedAt: now });
        updated.accounts++;
      }
    } else {
      finalId = genId();
      const row = { id: finalId, color: "#E8703A", icon: "wallet", createdAt: now, updatedAt: now, ...data };
      db.accounts.push(row);
      accountsById.set(finalId, row);
      created.accounts++;
    }
    seenAccounts.add(finalId!);
    accountNameToId.set(normalizeKey(data.name), finalId!);
  }

  for (const existing of [...db.accounts]) {
    if (seenAccounts.has(existing.id) || !canDelete(existing.id)) continue;
    const used =
      db.transactions.some((t) => t.accountId === existing.id) ||
      db.transfers.some((t) => t.fromAccountId === existing.id || t.toAccountId === existing.id);
    if (used) {
      if (existing.archived) continue;
      existing.archived = true;
      warnings.push(`Cuenta "${existing.name}" eliminada de la hoja: se archivó (tenía movimientos).`);
    } else {
      db.accounts = db.accounts.filter((a) => a.id !== existing.id);
    }
    deleted.accounts++;
  }

  // ---- Categorías ----
  const categoriesById = new Map(db.categories.map((c) => [c.id, c]));
  const seenCategories = new Set<string>();
  const categoryKeyToId = new Map(db.categories.map((c) => [`${normalizeKey(c.name)}|${c.type}`, c.id]));

  for (const row of categoryRows.slice(1)) {
    const [id, name, typeLabel, icon, color, budgetRaw] = row;
    if (!name || !name.trim()) continue;
    const type = labelToMovementType(typeLabel);
    if (!type) {
      warnings.push(`Categorías: tipo "${typeLabel}" no reconocido para "${name}", fila omitida.`);
      if (id?.trim()) seenCategories.add(id.trim());
      continue;
    }
    const budget = type === "expense" ? parseSheetNumber(budgetRaw) : null;
    const data = {
      name: name.trim(),
      type,
      icon: (icon || "tag").trim() || "tag",
      color: (color || "#8A7A6D").trim() || "#8A7A6D",
      budget: budget && budget > 0 ? budget : null,
    };
    let finalId = id?.trim();
    const existing = finalId ? categoriesById.get(finalId) : undefined;
    if (existing) {
      const changed = (Object.keys(data) as (keyof typeof data)[]).some((k) => existing[k] !== data[k]);
      if (changed) {
        Object.assign(existing, data);
        updated.categories++;
      }
    } else {
      finalId = genId();
      const row = { id: finalId, createdAt: now, ...data };
      db.categories.push(row);
      categoriesById.set(finalId, row);
      created.categories++;
    }
    seenCategories.add(finalId!);
    categoryKeyToId.set(`${normalizeKey(data.name)}|${data.type}`, finalId!);
  }

  for (const existing of [...db.categories]) {
    if (seenCategories.has(existing.id) || !canDelete(existing.id)) continue;
    db.transactions.forEach((t) => {
      if (t.categoryId === existing.id) t.categoryId = null;
    });
    db.categories = db.categories.filter((c) => c.id !== existing.id);
    deleted.categories++;
  }

  // ---- Transacciones ----
  const transactionsById = new Map(db.transactions.map((t) => [t.id, t]));
  const seenTransactions = new Set<string>();

  transactionRows.slice(1).forEach((row, idx) => {
    const rowNum = idx + 2;
    const [id, dateRaw, typeLabel, amountRaw, accountName, categoryName, description] = row;
    const rowId = id?.trim();
    if (!dateRaw && !amountRaw && !accountName) return;
    // Una fila con ID que no se puede leer no debe provocar que se borre ese movimiento
    if (rowId) seenTransactions.add(rowId);

    const type = labelToMovementType(typeLabel);
    if (!type) return void warnings.push(`Transacciones fila ${rowNum}: tipo "${typeLabel}" no reconocido, omitida.`);
    const date = parseSheetDate(dateRaw);
    if (!date) return void warnings.push(`Transacciones fila ${rowNum}: fecha "${dateRaw}" no válida, omitida.`);
    const amount = parseSheetNumber(amountRaw);
    if (amount === null || amount <= 0) {
      return void warnings.push(`Transacciones fila ${rowNum}: importe "${amountRaw}" no válido, omitida.`);
    }
    const accountId = accountNameToId.get(normalizeKey(accountName));
    if (!accountId) return void warnings.push(`Transacciones fila ${rowNum}: cuenta "${accountName}" no encontrada, omitida.`);
    let categoryId: string | null = null;
    if (categoryName && categoryName.trim()) {
      const found = categoryKeyToId.get(`${normalizeKey(categoryName)}|${type}`);
      if (!found) {
        return void warnings.push(`Transacciones fila ${rowNum}: categoría "${categoryName}" no encontrada, omitida.`);
      }
      categoryId = found;
    }
    const data = { amount, type, accountId, categoryId, description: description?.trim() || null };
    const existing = rowId ? transactionsById.get(rowId) : undefined;
    if (existing) {
      const changed =
        (Object.keys(data) as (keyof typeof data)[]).some((k) => existing[k] !== data[k]) ||
        dayKey(existing.date) !== dayKey(date);
      if (changed) {
        Object.assign(existing, data);
        if (dayKey(existing.date) !== dayKey(date)) existing.date = date;
        updated.transactions++;
      }
    } else {
      const newId = genId();
      db.transactions.push({ id: newId, date, createdAt: now, ...data });
      seenTransactions.add(newId);
      created.transactions++;
    }
  });

  for (const existing of [...db.transactions]) {
    if (seenTransactions.has(existing.id) || !canDelete(existing.id)) continue;
    db.transactions = db.transactions.filter((t) => t.id !== existing.id);
    deleted.transactions++;
  }

  // ---- Transferencias ----
  const transfersById = new Map(db.transfers.map((t) => [t.id, t]));
  const seenTransfers = new Set<string>();

  transferRows.slice(1).forEach((row, idx) => {
    const rowNum = idx + 2;
    const [id, dateRaw, fromName, toName, amountRaw, description] = row;
    const rowId = id?.trim();
    if (!dateRaw && !fromName && !toName) return;
    if (rowId) seenTransfers.add(rowId);

    const date = parseSheetDate(dateRaw);
    if (!date) return void warnings.push(`Transferencias fila ${rowNum}: fecha "${dateRaw}" no válida, omitida.`);
    const amount = parseSheetNumber(amountRaw);
    if (amount === null || amount <= 0) {
      return void warnings.push(`Transferencias fila ${rowNum}: importe "${amountRaw}" no válido, omitida.`);
    }
    const fromAccountId = accountNameToId.get(normalizeKey(fromName));
    const toAccountId = accountNameToId.get(normalizeKey(toName));
    if (!fromAccountId || !toAccountId) {
      return void warnings.push(
        `Transferencias fila ${rowNum}: cuenta "${!fromAccountId ? fromName : toName}" no encontrada, omitida.`
      );
    }
    if (fromAccountId === toAccountId) {
      return void warnings.push(`Transferencias fila ${rowNum}: origen y destino son la misma cuenta, omitida.`);
    }
    const data = { amount, fromAccountId, toAccountId, description: description?.trim() || null };
    const existing = rowId ? transfersById.get(rowId) : undefined;
    if (existing) {
      const changed =
        (Object.keys(data) as (keyof typeof data)[]).some((k) => existing[k] !== data[k]) ||
        dayKey(existing.date) !== dayKey(date);
      if (changed) {
        Object.assign(existing, data);
        if (dayKey(existing.date) !== dayKey(date)) existing.date = date;
        updated.transfers++;
      }
    } else {
      const newId = genId();
      db.transfers.push({ id: newId, date, createdAt: now, ...data });
      seenTransfers.add(newId);
      created.transfers++;
    }
  });

  for (const existing of [...db.transfers]) {
    if (seenTransfers.has(existing.id) || !canDelete(existing.id)) continue;
    db.transfers = db.transfers.filter((t) => t.id !== existing.id);
    deleted.transfers++;
  }

  // Filas nuevas escritas a mano en la hoja (sin ID): hay que volver a subir
  // la hoja para que reciban su ID y no se dupliquen en la siguiente importación.
  const needsPush =
    Object.values(created).some(Boolean) || Object.values(deleted).some(Boolean) || Object.values(updated).some(Boolean);

  return { warnings, created, updated, deleted, needsPush };
}

export async function importFromSheets(allowDeletes: boolean): Promise<GoogleImportResult> {
  // Los cambios locales aún no subidos tienen prioridad: se suben antes de leer
  // la hoja para que la importación no los deshaga.
  const before = await getDb();
  if (before.google?.pendingPush && before.google.spreadsheetId) await syncToSheets();

  return exclusive(async () => {
    const { accessToken, account } = await getValidAccessToken();
    const spreadsheetId = account.spreadsheetId;
    if (!spreadsheetId) {
      throw new Error('Todavía no existe una hoja de cálculo. Pulsa "Sincronizar ahora" primero para crearla.');
    }

    const sheets = await readSheetValues(accessToken, spreadsheetId, [
      "Cuentas!A:G",
      "Categorías!A:F",
      "Transacciones!A:G",
      "Transferencias!A:F",
    ]);

    const result = await mutate(
      (db) => {
        const r = applyImport(db, sheets, allowDeletes);
        // Si la subida posterior fallase, quedará pendiente: las filas nuevas
        // sin ID nunca se vuelven a importar duplicadas.
        if (r.needsPush && db.google) db.google.pendingPush = true;
        return r;
      },
      { touchesData: false }
    );

    const snapshot = await getDb();
    if (result.needsPush) await pushAllSheets(accessToken, spreadsheetId, snapshot);
    const lastSyncedAt = new Date().toISOString();
    await mutate(
      (draft) => {
        if (!draft.google) return;
        draft.google.lastSyncedAt = lastSyncedAt;
        if (result.needsPush) draft.google.knownIds = allIds(snapshot);
        if (draft.revision === snapshot.revision && result.needsPush) draft.google.pendingPush = false;
      },
      { touchesData: false }
    );

    return {
      spreadsheetUrl: account.spreadsheetUrl || "",
      lastSyncedAt,
      created: result.created,
      updated: result.updated,
      deleted: result.deleted,
      warnings: result.warnings,
    };
  });
}

// Ciclo automático en segundo plano: si hay cambios locales sin subir, los
// sube (la app manda); si no, trae los cambios hechos en la hoja sin borrar nada.
export async function autoSyncTick(): Promise<"pushed" | "imported" | "skipped"> {
  const db = await getDb();
  if (!db.google) return "skipped";
  if (db.google.pendingPush || !db.google.spreadsheetId) {
    await syncToSheets();
    return "pushed";
  }
  await importFromSheets(false);
  return "imported";
}
