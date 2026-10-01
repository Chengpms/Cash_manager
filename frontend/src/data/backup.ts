import { Database, NormalizeReport, getDb, normalizeDatabase, replaceData } from "./db";
import { filterTransactions } from "./service";
import { desktop, platform } from "./platform";
import { toInputDate } from "../utils/format";
import type { TransactionFilters } from "../types";

// Copias de seguridad (JSON) y exportación de movimientos (CSV). Sirven para
// pasar los datos de un dispositivo a otro (PC <-> móvil) o guardarlos aparte.

const BACKUP_KIND = "gestor-dinero-backup";

function today() {
  return toInputDate(); // fecha local, no UTC
}

// Guarda un archivo de texto con el mecanismo propio de cada plataforma.
// Devuelve una descripción de dónde quedó, o null si el usuario canceló.
export async function saveTextFile(fileName: string, content: string, mime: string): Promise<string | null> {
  if (desktop) {
    return desktop.saveFile({ defaultName: fileName, content });
  }
  if (platform === "android") {
    const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const written = await Filesystem.writeFile({
      path: fileName,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    // El menú de compartir permite guardarlo en Archivos, Drive, enviarlo por correo...
    try {
      await Share.share({ title: fileName, files: [written.uri], dialogTitle: "Guardar o enviar" });
    } catch (err: any) {
      if (/cancel/i.test(err?.message || "")) return null; // el usuario cerró el menú
      throw err;
    }
    return fileName;
  }
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return fileName;
}

export async function exportBackup(): Promise<string | null> {
  const db = await getDb();
  // Ni los tokens de Google ni las credenciales viajan en la copia
  const payload = {
    kind: BACKUP_KIND,
    exportedAt: new Date().toISOString(),
    version: db.version,
    accounts: db.accounts,
    categories: db.categories,
    transactions: db.transactions,
    transfers: db.transfers,
  };
  return saveTextFile(`gestor-dinero-${today()}.json`, JSON.stringify(payload, null, 2), "application/json");
}

export interface RestoreSummary {
  accounts: number;
  categories: number;
  transactions: number;
  transfers: number;
  dropped: number;
}

export function parseBackup(text: string): { db: Database; summary: RestoreSummary } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("El archivo no es un JSON válido");
  }
  const report: NormalizeReport = { dropped: 0 };
  const db = normalizeDatabase(raw, report);
  return {
    db,
    summary: {
      accounts: db.accounts.length,
      categories: db.categories.length,
      transactions: db.transactions.length,
      transfers: db.transfers.length,
      dropped: report.dropped,
    },
  };
}

export async function restoreBackup(db: Database) {
  await replaceData(db);
}

function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  // Evita que hojas de cálculo interpreten como fórmula un texto que empiece por = + - @
  const safe = /^[=+\-@\t\r]/.test(s) && typeof value === "string" ? `'${s}` : s;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function exportTransactionsCsv(filters: TransactionFilters = {}): Promise<string | null> {
  const db = await getDb();
  const rows = filterTransactions(db, { ...filters, limit: undefined });
  const accountName = new Map(db.accounts.map((a) => [a.id, a.name]));
  const categoryName = new Map(db.categories.map((c) => [c.id, c.name]));
  const lines = [
    ["Fecha", "Tipo", "Importe", "Cuenta", "Categoría", "Descripción"].join(";"),
    ...rows.map((t) =>
      [
        t.date.slice(0, 10),
        t.type === "income" ? "Ingreso" : "Gasto",
        // Coma decimal para que Excel/LibreOffice en español lo lean como número
        t.amount.toFixed(2).replace(".", ","),
        accountName.get(t.accountId) ?? "",
        (t.categoryId && categoryName.get(t.categoryId)) || "",
        t.description ?? "",
      ]
        .map(csvCell)
        .join(";")
    ),
  ];
  // BOM para que Excel detecte UTF-8 (tildes y ñ)
  return saveTextFile(`movimientos-${today()}.csv`, "﻿" + lines.join("\r\n"), "text/csv");
}
