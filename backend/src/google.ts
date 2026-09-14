import { OAuth2Client } from "google-auth-library";
import { prisma } from "./db";
import { computeAccountBalance } from "./utils";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const SPREADSHEET_TITLE = "Gestor de Dinero";
const SHEET_NAMES = ["Cuentas", "Categorías", "Transacciones", "Transferencias"];

// ---------- Traducciones Español <-> valores internos ----------

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: "Cuenta corriente",
  savings: "Ahorros",
  cash: "Efectivo",
  credit: "Tarjeta de crédito",
  investment: "Inversión",
};

function accountTypeLabel(type: string): string {
  return ACCOUNT_TYPE_LABELS[type] || type;
}

function labelToAccountType(raw: string): string | null {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (Object.keys(ACCOUNT_TYPE_LABELS).includes(lower)) return lower;
  const entry = Object.entries(ACCOUNT_TYPE_LABELS).find(([, label]) => label.toLowerCase() === lower);
  return entry ? entry[0] : null;
}

function movementTypeLabel(type: string): string {
  return type === "income" ? "Ingreso" : "Gasto";
}

function labelToMovementType(raw: string): "income" | "expense" | null {
  const lower = (raw || "").trim().toLowerCase();
  if (lower === "ingreso" || lower === "income") return "income";
  if (lower === "gasto" || lower === "expense") return "expense";
  return null;
}

function parseSheetBool(raw: string): boolean {
  const v = (raw || "").trim().toLowerCase();
  return v === "sí" || v === "si" || v === "true" || v === "1" || v === "yes";
}

function parseSheetNumber(raw: string): number | null {
  const cleaned = (raw ?? "").toString().trim().replace(/[€$\s]/g, "").replace(",", ".");
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseSheetDate(raw: string): Date | null {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;

  // ISO: yyyy-mm-dd
  let m = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  // Formato español: dd/mm/yyyy
  m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return isNaN(d.getTime()) ? null : d;
  }

  const fallback = new Date(trimmed);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function normalizeKey(value: string): string {
  return (value || "").trim().toLowerCase();
}

// ---------- OAuth ----------

function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Faltan las credenciales de Google (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI) en backend/.env. Consulta GOOGLE_SETUP.md."
    );
  }

  return new OAuth2Client({ clientId, clientSecret, redirectUri });
}

export function getAuthUrl(): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

export async function handleCallback(code: string): Promise<void> {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.access_token) {
    throw new Error("Google no devolvió un token de acceso");
  }

  const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userInfoRes.ok) {
    throw new Error("No se pudo obtener el email de la cuenta de Google");
  }
  const userInfo = (await userInfoRes.json()) as { email?: string };

  const existing = await prisma.googleAccount.findFirst();

  const data = {
    email: userInfo.email || "cuenta-google",
    accessToken: tokens.access_token,
    // Google solo envía refresh_token la primera vez que se concede consentimiento;
    // si ya teníamos uno guardado y esta vez no llega, conservamos el anterior.
    refreshToken: tokens.refresh_token || existing?.refreshToken || "",
    expiryDate: tokens.expiry_date ? BigInt(tokens.expiry_date) : null,
  };

  if (!data.refreshToken) {
    throw new Error(
      "Google no envió un refresh token. Revoca el acceso en https://myaccount.google.com/permissions y vuelve a conectar."
    );
  }

  if (existing) {
    await prisma.googleAccount.update({ where: { id: existing.id }, data });
  } else {
    await prisma.googleAccount.create({ data });
  }
}

async function getValidAccessToken() {
  const account = await prisma.googleAccount.findFirst();
  if (!account) {
    throw new Error("No hay ninguna cuenta de Google conectada");
  }

  const isExpired =
    !account.expiryDate || BigInt(Date.now()) > account.expiryDate - BigInt(60_000);

  if (!isExpired) {
    return { accessToken: account.accessToken, account };
  }

  const client = getOAuthClient();
  client.setCredentials({ refresh_token: account.refreshToken });
  const { token } = await client.getAccessToken();

  if (!token) {
    throw new Error("No se pudo renovar el acceso a Google. Vuelve a conectar tu cuenta.");
  }

  const newExpiry = client.credentials.expiry_date;
  const updated = await prisma.googleAccount.update({
    where: { id: account.id },
    data: {
      accessToken: token,
      expiryDate: newExpiry ? BigInt(newExpiry) : null,
    },
  });

  return { accessToken: token, account: updated };
}

async function createSpreadsheet(accessToken: string) {
  const res = await fetch(SHEETS_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: { title: SPREADSHEET_TITLE },
      sheets: SHEET_NAMES.map((title) => ({ properties: { title } })),
    }),
  });

  if (!res.ok) {
    throw new Error(`No se pudo crear la hoja de cálculo: ${await res.text()}`);
  }

  return res.json() as Promise<{ spreadsheetId: string; spreadsheetUrl: string }>;
}

async function writeSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  rows: (string | number)[][]
) {
  // Vacía la pestaña antes de escribir para no dejar filas antiguas colgando
  await fetch(`${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}:clear`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const range = `${sheetName}!A1`;
  const res = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: rows }),
    }
  );

  if (!res.ok) {
    throw new Error(`No se pudo escribir en la pestaña "${sheetName}": ${await res.text()}`);
  }
}

async function readSheetValues(
  accessToken: string,
  spreadsheetId: string,
  ranges: string[]
): Promise<string[][][]> {
  const query = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
  const res = await fetch(`${SHEETS_API}/${spreadsheetId}/values:batchGet?${query}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`No se pudieron leer los datos de la hoja: ${await res.text()}`);
  }

  const body = (await res.json()) as { valueRanges: { values?: string[][] }[] };
  return body.valueRanges.map((r) => r.values || []);
}

// Escribe el estado actual de la base de datos en las 4 pestañas, incluyendo
// la columna ID que permite reconocer cada fila al volver a importar.
async function pushAllSheets(accessToken: string, spreadsheetId: string) {
  const [accounts, categories, transactions, transfers] = await Promise.all([
    prisma.account.findMany({
      include: { transactions: true, transfersFrom: true, transfersTo: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.transaction.findMany({
      include: { account: true, category: true },
      orderBy: { date: "desc" },
    }),
    prisma.transfer.findMany({
      include: { fromAccount: true, toAccount: true },
      orderBy: { date: "desc" },
    }),
  ]);

  const accountRows: (string | number)[][] = [
    ["ID", "Nombre", "Tipo", "Divisa", "Balance inicial", "Balance actual", "Archivada"],
    ...accounts.map((a) => [
      a.id,
      a.name,
      accountTypeLabel(a.type),
      a.currency,
      a.initialBalance,
      computeAccountBalance(a, a.transactions, a.transfersFrom, a.transfersTo),
      a.archived ? "Sí" : "No",
    ]),
  ];

  const categoryRows: (string | number)[][] = [
    ["ID", "Nombre", "Tipo", "Icono", "Color"],
    ...categories.map((c) => [c.id, c.name, movementTypeLabel(c.type), c.icon, c.color]),
  ];

  const transactionRows: (string | number)[][] = [
    ["ID", "Fecha", "Tipo", "Importe", "Cuenta", "Categoría", "Descripción"],
    ...transactions.map((t) => [
      t.id,
      new Date(t.date).toISOString().slice(0, 10),
      movementTypeLabel(t.type),
      t.amount,
      t.account?.name || "",
      t.category?.name || "",
      t.description || "",
    ]),
  ];

  const transferRows: (string | number)[][] = [
    ["ID", "Fecha", "Desde", "Hacia", "Importe", "Descripción"],
    ...transfers.map((t) => [
      t.id,
      new Date(t.date).toISOString().slice(0, 10),
      t.fromAccount?.name || "",
      t.toAccount?.name || "",
      t.amount,
      t.description || "",
    ]),
  ];

  await writeSheet(accessToken, spreadsheetId, "Cuentas", accountRows);
  await writeSheet(accessToken, spreadsheetId, "Categorías", categoryRows);
  await writeSheet(accessToken, spreadsheetId, "Transacciones", transactionRows);
  await writeSheet(accessToken, spreadsheetId, "Transferencias", transferRows);

  await applySheetFormatting(accessToken, spreadsheetId);
}

// ---------- Formato visual de la hoja (moneda, alineación, ancho de columnas) ----------

async function getSheetIdMap(accessToken: string, spreadsheetId: string): Promise<Record<string, number>> {
  const res = await fetch(`${SHEETS_API}/${spreadsheetId}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    console.error("No se pudo leer la estructura de la hoja para darle formato:", await res.text());
    return {};
  }
  const body = (await res.json()) as { sheets: { properties: { sheetId: number; title: string } }[] };
  const map: Record<string, number> = {};
  for (const s of body.sheets) map[s.properties.title] = s.properties.sheetId;
  return map;
}

const CURRENCY_FORMAT = { type: "CURRENCY", pattern: '#,##0.00 "€"' };

function repeatCellRequest(
  sheetId: number,
  startRow: number,
  endRow: number | undefined,
  startCol: number,
  endCol: number,
  cell: Record<string, unknown>,
  fields: string
) {
  return {
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: startRow,
        ...(endRow !== undefined ? { endRowIndex: endRow } : {}),
        startColumnIndex: startCol,
        endColumnIndex: endCol,
      },
      cell: { userEnteredFormat: cell },
      fields,
    },
  };
}

// Columnas de cada pestaña (deben coincidir con las cabeceras escritas más arriba)
const SHEET_COLUMN_COUNTS: Record<string, number> = {
  Cuentas: 7,
  "Categorías": 5,
  Transacciones: 7,
  Transferencias: 6,
};

async function applySheetFormatting(accessToken: string, spreadsheetId: string) {
  const sheetIds = await getSheetIdMap(accessToken, spreadsheetId);
  const requests: Record<string, unknown>[] = [];

  for (const [name, sheetId] of Object.entries(sheetIds)) {
    const numCols = SHEET_COLUMN_COUNTS[name];
    if (!numCols) continue;

    // Cabecera en negrita y fila fija al hacer scroll
    requests.push(
      repeatCellRequest(sheetId, 0, 1, 0, numCols, { textFormat: { bold: true } }, "userEnteredFormat.textFormat")
    );
    requests.push({
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount",
      },
    });
    // Ancho de columna ajustado al contenido, para que no se corte ningún texto
    requests.push({
      autoResizeDimensions: {
        dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: numCols },
      },
    });

    if (name === "Cuentas") {
      // Balance inicial (col E) y Balance actual (col F): moneda, alineado a la derecha
      requests.push(
        repeatCellRequest(
          sheetId,
          1,
          undefined,
          4,
          6,
          { numberFormat: CURRENCY_FORMAT, horizontalAlignment: "RIGHT" },
          "userEnteredFormat.numberFormat,userEnteredFormat.horizontalAlignment"
        )
      );
    }
    if (name === "Transacciones") {
      // Fecha (col B): centrada
      requests.push(
        repeatCellRequest(sheetId, 1, undefined, 1, 2, { horizontalAlignment: "CENTER" }, "userEnteredFormat.horizontalAlignment")
      );
      // Importe (col D): moneda, alineado a la derecha
      requests.push(
        repeatCellRequest(
          sheetId,
          1,
          undefined,
          3,
          4,
          { numberFormat: CURRENCY_FORMAT, horizontalAlignment: "RIGHT" },
          "userEnteredFormat.numberFormat,userEnteredFormat.horizontalAlignment"
        )
      );
    }
    if (name === "Transferencias") {
      // Fecha (col B): centrada
      requests.push(
        repeatCellRequest(sheetId, 1, undefined, 1, 2, { horizontalAlignment: "CENTER" }, "userEnteredFormat.horizontalAlignment")
      );
      // Importe (col E): moneda, alineado a la derecha
      requests.push(
        repeatCellRequest(
          sheetId,
          1,
          undefined,
          4,
          5,
          { numberFormat: CURRENCY_FORMAT, horizontalAlignment: "RIGHT" },
          "userEnteredFormat.numberFormat,userEnteredFormat.horizontalAlignment"
        )
      );
    }
  }

  if (requests.length === 0) return;

  const res = await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });

  if (!res.ok) {
    // El formato es algo "extra": si falla no interrumpimos la sincronización de datos
    console.error("No se pudo aplicar el formato a la hoja:", await res.text());
  }
}

export async function syncToSheets(): Promise<{ spreadsheetUrl: string; lastSyncedAt: Date }> {
  const { accessToken, account } = await getValidAccessToken();

  let spreadsheetId = account.spreadsheetId;
  let spreadsheetUrl = account.spreadsheetUrl;

  if (!spreadsheetId) {
    const created = await createSpreadsheet(accessToken);
    spreadsheetId = created.spreadsheetId;
    spreadsheetUrl = created.spreadsheetUrl;
  }

  await pushAllSheets(accessToken, spreadsheetId!);

  const lastSyncedAt = new Date();
  await prisma.googleAccount.update({
    where: { id: account.id },
    data: { spreadsheetId, spreadsheetUrl, lastSyncedAt },
  });

  return { spreadsheetUrl: spreadsheetUrl!, lastSyncedAt };
}

// ---------- Importar cambios hechos a mano en la hoja ----------

export interface ImportResult {
  spreadsheetUrl: string;
  lastSyncedAt: Date;
  created: { accounts: number; categories: number; transactions: number; transfers: number };
  updated: { accounts: number; categories: number; transactions: number; transfers: number };
  deleted: { accounts: number; categories: number; transactions: number; transfers: number };
  warnings: string[];
}

export async function importFromSheets(allowDeletes: boolean): Promise<ImportResult> {
  const { accessToken, account } = await getValidAccessToken();
  const spreadsheetId = account.spreadsheetId;

  if (!spreadsheetId) {
    throw new Error(
      "Todavía no existe una hoja de cálculo. Pulsa \"Sincronizar ahora\" primero para crearla."
    );
  }

  const [accountRows, categoryRows, transactionRows, transferRows] = await readSheetValues(
    accessToken,
    spreadsheetId,
    ["Cuentas!A:G", "Categorías!A:E", "Transacciones!A:G", "Transferencias!A:F"]
  );

  const warnings: string[] = [];
  const created = { accounts: 0, categories: 0, transactions: 0, transfers: 0 };
  const updated = { accounts: 0, categories: 0, transactions: 0, transfers: 0 };
  const deleted = { accounts: 0, categories: 0, transactions: 0, transfers: 0 };

  // ---- Cuentas ----
  const existingAccounts = await prisma.account.findMany();
  const accountsById = new Map(existingAccounts.map((a) => [a.id, a]));
  const seenAccountIds = new Set<string>();
  const accountNameToId = new Map<string, string>();

  for (const row of accountRows.slice(1)) {
    const [id, name, typeLabel, currency, initialBalanceRaw, , archivedRaw] = row;
    if (!name || !name.trim()) continue;

    const type = labelToAccountType(typeLabel) || "checking";
    if (!labelToAccountType(typeLabel)) {
      warnings.push(`Cuentas: tipo "${typeLabel}" no reconocido para "${name}", se usó "Cuenta corriente".`);
    }
    const initialBalance = parseSheetNumber(initialBalanceRaw) ?? 0;
    const archived = parseSheetBool(archivedRaw);
    const data = { name: name.trim(), type, currency: (currency || "EUR").trim(), initialBalance, archived };

    let finalId = id?.trim();
    if (finalId && accountsById.has(finalId)) {
      const existing = accountsById.get(finalId)!;
      const changed =
        existing.name !== data.name ||
        existing.type !== data.type ||
        existing.currency !== data.currency ||
        existing.initialBalance !== data.initialBalance ||
        existing.archived !== data.archived;
      if (changed) {
        await prisma.account.update({ where: { id: finalId }, data });
        updated.accounts++;
      }
    } else {
      const createdAccount = await prisma.account.create({ data });
      finalId = createdAccount.id;
      created.accounts++;
    }

    seenAccountIds.add(finalId!);
    accountNameToId.set(normalizeKey(data.name), finalId!);
  }

  if (allowDeletes) {
    for (const existing of existingAccounts) {
      if (seenAccountIds.has(existing.id)) continue;
      const [txCount, transferCount] = await Promise.all([
        prisma.transaction.count({ where: { accountId: existing.id } }),
        prisma.transfer.count({ where: { OR: [{ fromAccountId: existing.id }, { toAccountId: existing.id }] } }),
      ]);
      if (txCount > 0 || transferCount > 0) {
        await prisma.account.update({ where: { id: existing.id }, data: { archived: true } });
        warnings.push(`Cuenta "${existing.name}" eliminada de la hoja: se archivó (tenía movimientos).`);
      } else {
        await prisma.account.delete({ where: { id: existing.id } });
      }
      deleted.accounts++;
    }
  }

  // ---- Categorías ----
  const existingCategories = await prisma.category.findMany();
  const categoriesById = new Map(existingCategories.map((c) => [c.id, c]));
  const seenCategoryIds = new Set<string>();
  const categoryKeyToId = new Map<string, string>();

  for (const row of categoryRows.slice(1)) {
    const [id, name, typeLabel, icon, color] = row;
    if (!name || !name.trim()) continue;

    const type = labelToMovementType(typeLabel);
    if (!type) {
      warnings.push(`Categorías: tipo "${typeLabel}" no reconocido para "${name}", fila omitida.`);
      continue;
    }
    const data = {
      name: name.trim(),
      type,
      icon: (icon || "tag").trim() || "tag",
      color: (color || "#8A7A6D").trim() || "#8A7A6D",
    };

    let finalId = id?.trim();
    if (finalId && categoriesById.has(finalId)) {
      const existing = categoriesById.get(finalId)!;
      const changed =
        existing.name !== data.name ||
        existing.type !== data.type ||
        existing.icon !== data.icon ||
        existing.color !== data.color;
      if (changed) {
        await prisma.category.update({ where: { id: finalId }, data });
        updated.categories++;
      }
    } else {
      const createdCategory = await prisma.category.create({ data });
      finalId = createdCategory.id;
      created.categories++;
    }

    seenCategoryIds.add(finalId!);
    categoryKeyToId.set(`${normalizeKey(data.name)}|${data.type}`, finalId!);
  }

  if (allowDeletes) {
    for (const existing of existingCategories) {
      if (seenCategoryIds.has(existing.id)) continue;
      await prisma.transaction.updateMany({ where: { categoryId: existing.id }, data: { categoryId: null } });
      await prisma.category.delete({ where: { id: existing.id } });
      deleted.categories++;
    }
  }

  // ---- Transacciones ----
  const existingTransactions = await prisma.transaction.findMany();
  const transactionsById = new Map(existingTransactions.map((t) => [t.id, t]));
  const seenTransactionIds = new Set<string>();

  const transactionDataRows = transactionRows.slice(1);
  for (let idx = 0; idx < transactionDataRows.length; idx++) {
    const row = transactionDataRows[idx];
    const rowNum = idx + 2;
    const [id, dateRaw, typeLabel, amountRaw, accountName, categoryName, description] = row;
    if (!dateRaw && !amountRaw && !accountName) continue; // fila vacía

    const type = labelToMovementType(typeLabel);
    if (!type) {
      warnings.push(`Transacciones fila ${rowNum}: tipo "${typeLabel}" no reconocido, omitida.`);
      continue;
    }
    const date = parseSheetDate(dateRaw);
    if (!date) {
      warnings.push(`Transacciones fila ${rowNum}: fecha "${dateRaw}" no válida, omitida.`);
      continue;
    }
    const amount = parseSheetNumber(amountRaw);
    if (amount === null || amount <= 0) {
      warnings.push(`Transacciones fila ${rowNum}: importe "${amountRaw}" no válido, omitida.`);
      continue;
    }
    const accountId = accountNameToId.get(normalizeKey(accountName));
    if (!accountId) {
      warnings.push(`Transacciones fila ${rowNum}: cuenta "${accountName}" no encontrada, omitida.`);
      continue;
    }
    let categoryId: string | null = null;
    if (categoryName && categoryName.trim()) {
      const found = categoryKeyToId.get(`${normalizeKey(categoryName)}|${type}`);
      if (!found) {
        warnings.push(`Transacciones fila ${rowNum}: categoría "${categoryName}" no encontrada, omitida.`);
        continue;
      }
      categoryId = found;
    }

    const data = { amount, type, date, accountId, categoryId, description: description?.trim() || null };
    const finalId = id?.trim();

    if (finalId && transactionsById.has(finalId)) {
      const existing = transactionsById.get(finalId)!;
      const changed =
        existing.amount !== data.amount ||
        existing.type !== data.type ||
        existing.date.getTime() !== data.date.getTime() ||
        existing.accountId !== data.accountId ||
        existing.categoryId !== data.categoryId ||
        (existing.description || null) !== data.description;
      if (changed) {
        await prisma.transaction.update({ where: { id: finalId }, data });
        updated.transactions++;
      }
      seenTransactionIds.add(finalId);
    } else {
      const createdTransaction = await prisma.transaction.create({ data });
      created.transactions++;
      seenTransactionIds.add(createdTransaction.id);
    }
  }

  if (allowDeletes) {
    for (const existing of existingTransactions) {
      if (seenTransactionIds.has(existing.id)) continue;
      await prisma.transaction.delete({ where: { id: existing.id } });
      deleted.transactions++;
    }
  }

  // ---- Transferencias ----
  const existingTransfers = await prisma.transfer.findMany();
  const transfersById = new Map(existingTransfers.map((t) => [t.id, t]));
  const seenTransferIds = new Set<string>();

  for (let idx = 0; idx < transferRows.slice(1).length; idx++) {
    const row = transferRows.slice(1)[idx];
    const rowNum = idx + 2;
    const [id, dateRaw, fromName, toName, amountRaw, description] = row;
    if (!dateRaw && !fromName && !toName) continue;

    const date = parseSheetDate(dateRaw);
    if (!date) {
      warnings.push(`Transferencias fila ${rowNum}: fecha "${dateRaw}" no válida, omitida.`);
      continue;
    }
    const amount = parseSheetNumber(amountRaw);
    if (amount === null || amount <= 0) {
      warnings.push(`Transferencias fila ${rowNum}: importe "${amountRaw}" no válido, omitida.`);
      continue;
    }
    const fromAccountId = accountNameToId.get(normalizeKey(fromName));
    const toAccountId = accountNameToId.get(normalizeKey(toName));
    if (!fromAccountId || !toAccountId) {
      warnings.push(`Transferencias fila ${rowNum}: cuenta "${!fromAccountId ? fromName : toName}" no encontrada, omitida.`);
      continue;
    }

    const data = { amount, date, fromAccountId, toAccountId, description: description?.trim() || null };
    const finalId = id?.trim();

    if (finalId && transfersById.has(finalId)) {
      const existing = transfersById.get(finalId)!;
      const changed =
        existing.amount !== data.amount ||
        existing.date.getTime() !== data.date.getTime() ||
        existing.fromAccountId !== data.fromAccountId ||
        existing.toAccountId !== data.toAccountId ||
        (existing.description || null) !== data.description;
      if (changed) {
        await prisma.transfer.update({ where: { id: finalId }, data });
        updated.transfers++;
      }
      seenTransferIds.add(finalId);
    } else {
      const createdTransfer = await prisma.transfer.create({ data });
      created.transfers++;
      seenTransferIds.add(createdTransfer.id);
    }
  }

  if (allowDeletes) {
    for (const existing of existingTransfers) {
      if (seenTransferIds.has(existing.id)) continue;
      await prisma.transfer.delete({ where: { id: existing.id } });
      deleted.transfers++;
    }
  }

  // Vuelve a escribir la hoja para normalizarla: rellena los IDs de las filas
  // nuevas y refleja cualquier borrado aplicado en la app.
  await pushAllSheets(accessToken, spreadsheetId);

  const lastSyncedAt = new Date();
  await prisma.googleAccount.update({ where: { id: account.id }, data: { lastSyncedAt } });

  return {
    spreadsheetUrl: account.spreadsheetUrl!,
    lastSyncedAt,
    created,
    updated,
    deleted,
    warnings,
  };
}

export async function disconnect(): Promise<void> {
  await prisma.googleAccount.deleteMany();
}

export async function getStatus() {
  const account = await prisma.googleAccount.findFirst();
  if (!account) return { connected: false as const };
  return {
    connected: true as const,
    email: account.email,
    spreadsheetUrl: account.spreadsheetUrl,
    lastSyncedAt: account.lastSyncedAt,
  };
}
