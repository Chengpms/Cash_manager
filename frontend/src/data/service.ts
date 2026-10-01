import type {
  Account,
  BudgetStatus,
  Category,
  CategoryBreakdown,
  StatsSummary,
  Transaction,
  TransactionFilters,
  Transfer,
  TrendPoint,
} from "../types";
import {
  ACCOUNT_TYPES,
  AccountRow,
  CategoryRow,
  Database,
  MOVEMENT_TYPES,
  TransactionRow,
  TransferRow,
  genId,
  getDb,
  mutate,
  round2,
} from "./db";

// Lógica de negocio que antes vivía en el backend Express (rutas /api/*),
// ahora ejecutada dentro de la propia app sobre la base de datos local.

// ---------- Utilidades ----------

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} no encontrada`);
  }
}

function requireName(v: unknown, field = "El nombre"): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) throw new Error(`${field} es obligatorio`);
  if (s.length > 120) throw new Error(`${field} es demasiado largo (máx. 120 caracteres)`);
  return s;
}

function requireAmount(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) throw new Error("Introduce un importe mayor que 0");
  if (n > 1e12) throw new Error("El importe es demasiado grande");
  return round2(n);
}

function optionalNumber(v: unknown, field: string): number {
  if (v === undefined || v === null || v === "") return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) throw new Error(`${field} no es un número válido`);
  return round2(n);
}

function requireEnum<T extends string>(v: unknown, options: readonly T[], field: string): T {
  if (!options.includes(v as T)) throw new Error(`${field} no válido`);
  return v as T;
}

function parseDate(v: unknown): string {
  if (v === undefined || v === null || v === "") return new Date().toISOString();
  const d = new Date(v as string);
  if (isNaN(d.getTime())) throw new Error("Fecha no válida");
  return d.toISOString();
}

function optionalText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, 500) : null;
}

function has(obj: object, key: string) {
  return Object.prototype.hasOwnProperty.call(obj, key) && (obj as Record<string, unknown>)[key] !== undefined;
}

export function computeBalances(db: Database): Map<string, number> {
  const balances = new Map<string, number>();
  for (const a of db.accounts) balances.set(a.id, a.initialBalance);
  for (const t of db.transactions) {
    const b = balances.get(t.accountId);
    if (b !== undefined) balances.set(t.accountId, b + (t.type === "income" ? t.amount : -t.amount));
  }
  for (const t of db.transfers) {
    const from = balances.get(t.fromAccountId);
    if (from !== undefined) balances.set(t.fromAccountId, from - t.amount);
    const to = balances.get(t.toAccountId);
    if (to !== undefined) balances.set(t.toAccountId, to + t.amount);
  }
  for (const [id, b] of balances) balances.set(id, round2(b));
  return balances;
}

function toAccount(a: AccountRow, balances: Map<string, number>): Account {
  return {
    id: a.id,
    name: a.name,
    type: a.type,
    currency: a.currency,
    color: a.color,
    icon: a.icon,
    initialBalance: a.initialBalance,
    archived: a.archived,
    createdAt: a.createdAt,
    balance: balances.get(a.id) ?? a.initialBalance,
  };
}

function toCategory(c: CategoryRow): Category {
  return { id: c.id, name: c.name, type: c.type, color: c.color, icon: c.icon, budget: c.budget };
}

function findAccount(db: Database, id: string): AccountRow {
  const a = db.accounts.find((x) => x.id === id);
  if (!a) throw new NotFoundError("Cuenta");
  return a;
}

function findCategory(db: Database, id: string): CategoryRow {
  const c = db.categories.find((x) => x.id === id);
  if (!c) throw new NotFoundError("Categoría");
  return c;
}

function byDateDesc<T extends { date: string; createdAt: string }>(a: T, b: T) {
  return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// ---------- Cuentas ----------

export async function getAccounts(opts: { archived?: boolean } = {}): Promise<Account[]> {
  const db = await getDb();
  const balances = computeBalances(db);
  return db.accounts
    .filter((a) => a.archived === !!opts.archived)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((a) => toAccount(a, balances));
}

function accountData(input: Partial<Account>, partial: boolean) {
  const data: Partial<AccountRow> = {};
  if (!partial || has(input, "name")) data.name = requireName(input.name);
  if (!partial || has(input, "type")) data.type = requireEnum(input.type, ACCOUNT_TYPES, "Tipo de cuenta");
  if (has(input, "currency")) {
    const cur = String(input.currency).trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(cur)) throw new Error("Divisa no válida (usa un código de 3 letras, ej. EUR)");
    data.currency = cur;
  }
  if (has(input, "color")) data.color = String(input.color);
  if (has(input, "icon")) data.icon = String(input.icon);
  if (has(input, "initialBalance")) data.initialBalance = optionalNumber(input.initialBalance, "El balance inicial");
  return data;
}

export async function createAccount(input: Partial<Account>): Promise<Account> {
  const data = accountData(input, false);
  const now = new Date().toISOString();
  return mutate((db) => {
    const row: AccountRow = {
      id: genId(),
      name: data.name!,
      type: data.type!,
      currency: data.currency ?? "EUR",
      color: data.color ?? "#E8703A",
      icon: data.icon ?? "wallet",
      initialBalance: data.initialBalance ?? 0,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    db.accounts.push(row);
    return toAccount(row, new Map([[row.id, row.initialBalance]]));
  });
}

export async function updateAccount(id: string, input: Partial<Account>): Promise<Account> {
  const data = accountData(input, true);
  return mutate((db) => {
    const row = findAccount(db, id);
    Object.assign(row, data, { updatedAt: new Date().toISOString() });
    return toAccount(row, computeBalances(db));
  });
}

// Borra la cuenta, o la archiva si tiene movimientos para no perder el histórico.
export async function deleteAccount(id: string): Promise<{ deleted?: boolean; archived?: boolean }> {
  return mutate((db) => {
    const row = findAccount(db, id);
    const used =
      db.transactions.some((t) => t.accountId === id) ||
      db.transfers.some((t) => t.fromAccountId === id || t.toAccountId === id);
    if (used) {
      row.archived = true;
      row.updatedAt = new Date().toISOString();
      return { archived: true };
    }
    db.accounts = db.accounts.filter((a) => a.id !== id);
    return { deleted: true };
  });
}

export async function restoreAccount(id: string): Promise<Account> {
  return mutate((db) => {
    const row = findAccount(db, id);
    row.archived = false;
    row.updatedAt = new Date().toISOString();
    return toAccount(row, computeBalances(db));
  });
}

// ---------- Categorías ----------

export async function getCategories(type?: string): Promise<Category[]> {
  const db = await getDb();
  return db.categories
    .filter((c) => !type || c.type === type)
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
    .map(toCategory);
}

function categoryData(input: Partial<Category>, partial: boolean) {
  const data: Partial<CategoryRow> = {};
  if (!partial || has(input, "name")) data.name = requireName(input.name);
  if (!partial || has(input, "type")) data.type = requireEnum(input.type, MOVEMENT_TYPES, "Tipo de categoría");
  if (has(input, "color")) data.color = String(input.color);
  if (has(input, "icon")) data.icon = String(input.icon);
  if (has(input, "budget")) {
    const b = input.budget;
    if (b === null || b === undefined || (b as unknown) === "" || b === 0) data.budget = null;
    else data.budget = requireAmount(b);
  }
  return data;
}

export async function createCategory(input: Partial<Category>): Promise<Category> {
  const data = categoryData(input, false);
  return mutate((db) => {
    const row: CategoryRow = {
      id: genId(),
      name: data.name!,
      type: data.type!,
      color: data.color ?? "#8A7A6D",
      icon: data.icon ?? "tag",
      budget: data.type === "expense" ? data.budget ?? null : null,
      createdAt: new Date().toISOString(),
    };
    db.categories.push(row);
    return toCategory(row);
  });
}

export async function updateCategory(id: string, input: Partial<Category>): Promise<Category> {
  const data = categoryData(input, true);
  return mutate((db) => {
    const row = findCategory(db, id);
    Object.assign(row, data);
    if (row.type !== "expense") row.budget = null;
    // Si cambia el tipo, los movimientos del otro tipo dejan de encajar con ella
    db.transactions.forEach((t) => {
      if (t.categoryId === id && t.type !== row.type) t.categoryId = null;
    });
    return toCategory(row);
  });
}

export async function deleteCategory(id: string): Promise<{ deleted: boolean }> {
  return mutate((db) => {
    findCategory(db, id);
    db.categories = db.categories.filter((c) => c.id !== id);
    db.transactions.forEach((t) => {
      if (t.categoryId === id) t.categoryId = null;
    });
    return { deleted: true };
  });
}

// ---------- Transacciones ----------

function expandTransaction(db: Database, t: TransactionRow, balances: Map<string, number>): Transaction {
  const account = db.accounts.find((a) => a.id === t.accountId);
  const category = t.categoryId ? db.categories.find((c) => c.id === t.categoryId) : undefined;
  return {
    ...t,
    account: account ? toAccount(account, balances) : undefined,
    category: category ? toCategory(category) : null,
  };
}

export function filterTransactions(db: Database, filters: TransactionFilters): TransactionRow[] {
  const from = filters.from ? new Date(filters.from).getTime() : null;
  const to = filters.to ? new Date(filters.to).getTime() : null;
  const search = filters.search?.trim().toLowerCase();
  const list = db.transactions.filter((t) => {
    if (filters.accountId && t.accountId !== filters.accountId) return false;
    if (filters.categoryId && t.categoryId !== filters.categoryId) return false;
    if (filters.type && t.type !== filters.type) return false;
    const time = new Date(t.date).getTime();
    if (from !== null && time < from) return false;
    if (to !== null && time > to) return false;
    if (search) {
      const category = t.categoryId ? db.categories.find((c) => c.id === t.categoryId)?.name : "";
      const haystack = `${t.description ?? ""} ${category ?? ""}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
  list.sort(byDateDesc);
  return filters.limit ? list.slice(0, Number(filters.limit)) : list;
}

export async function getTransactions(filters: TransactionFilters = {}): Promise<Transaction[]> {
  const db = await getDb();
  const balances = computeBalances(db);
  return filterTransactions(db, filters).map((t) => expandTransaction(db, t, balances));
}

function validateTransactionRefs(db: Database, row: TransactionRow, accountChanged = true) {
  const account = findAccount(db, row.accountId);
  if (account.archived && accountChanged) throw new Error("No se pueden añadir movimientos a una cuenta archivada");
  if (row.categoryId) {
    const category = findCategory(db, row.categoryId);
    if (category.type !== row.type) throw new Error("La categoría no corresponde al tipo de movimiento");
  }
}

export async function createTransaction(input: Partial<Transaction>): Promise<Transaction> {
  const row: TransactionRow = {
    id: genId(),
    amount: requireAmount(input.amount),
    type: requireEnum(input.type, MOVEMENT_TYPES, "Tipo de movimiento"),
    description: optionalText(input.description),
    date: parseDate(input.date),
    createdAt: new Date().toISOString(),
    accountId: requireName(input.accountId, "La cuenta"),
    categoryId: input.categoryId || null,
  };
  return mutate((db) => {
    validateTransactionRefs(db, row);
    db.transactions.push(row);
    return expandTransaction(db, row, computeBalances(db));
  });
}

export async function updateTransaction(id: string, input: Partial<Transaction>): Promise<Transaction> {
  return mutate((db) => {
    const row = db.transactions.find((t) => t.id === id);
    if (!row) throw new NotFoundError("Transacción");
    const next = { ...row };
    if (has(input, "amount")) next.amount = requireAmount(input.amount);
    if (has(input, "type")) next.type = requireEnum(input.type, MOVEMENT_TYPES, "Tipo de movimiento");
    if (has(input, "description") || input.description === null) next.description = optionalText(input.description);
    if (has(input, "date")) next.date = parseDate(input.date);
    if (has(input, "accountId") && input.accountId !== row.accountId) {
      next.accountId = requireName(input.accountId, "La cuenta");
    }
    if (has(input, "categoryId") || input.categoryId === null) next.categoryId = input.categoryId || null;
    if (next.accountId !== row.accountId || next.categoryId !== row.categoryId || next.type !== row.type) {
      validateTransactionRefs(db, next, next.accountId !== row.accountId);
    }
    Object.assign(row, next);
    return expandTransaction(db, row, computeBalances(db));
  });
}

export async function deleteTransaction(id: string): Promise<{ deleted: boolean }> {
  return mutate((db) => {
    const before = db.transactions.length;
    db.transactions = db.transactions.filter((t) => t.id !== id);
    if (db.transactions.length === before) throw new NotFoundError("Transacción");
    return { deleted: true };
  });
}

// ---------- Transferencias ----------

function expandTransfer(db: Database, t: TransferRow, balances: Map<string, number>): Transfer {
  const from = db.accounts.find((a) => a.id === t.fromAccountId);
  const to = db.accounts.find((a) => a.id === t.toAccountId);
  return {
    ...t,
    fromAccount: from ? toAccount(from, balances) : undefined,
    toAccount: to ? toAccount(to, balances) : undefined,
  };
}

export async function getTransfers(limit?: number): Promise<Transfer[]> {
  const db = await getDb();
  const balances = computeBalances(db);
  const list = [...db.transfers].sort(byDateDesc);
  return (limit ? list.slice(0, limit) : list).map((t) => expandTransfer(db, t, balances));
}

function validateTransfer(db: Database, row: TransferRow) {
  if (row.fromAccountId === row.toAccountId) {
    throw new Error("La cuenta de origen y destino no pueden ser la misma");
  }
  findAccount(db, row.fromAccountId);
  findAccount(db, row.toAccountId);
}

export async function createTransfer(input: Partial<Transfer>): Promise<Transfer> {
  const row: TransferRow = {
    id: genId(),
    amount: requireAmount(input.amount),
    description: optionalText(input.description),
    date: parseDate(input.date),
    createdAt: new Date().toISOString(),
    fromAccountId: requireName(input.fromAccountId, "La cuenta de origen"),
    toAccountId: requireName(input.toAccountId, "La cuenta de destino"),
  };
  return mutate((db) => {
    validateTransfer(db, row);
    db.transfers.push(row);
    return expandTransfer(db, row, computeBalances(db));
  });
}

export async function updateTransfer(id: string, input: Partial<Transfer>): Promise<Transfer> {
  return mutate((db) => {
    const row = db.transfers.find((t) => t.id === id);
    if (!row) throw new NotFoundError("Transferencia");
    const next = { ...row };
    if (has(input, "amount")) next.amount = requireAmount(input.amount);
    if (has(input, "description") || input.description === null) next.description = optionalText(input.description);
    if (has(input, "date")) next.date = parseDate(input.date);
    if (has(input, "fromAccountId")) next.fromAccountId = requireName(input.fromAccountId, "La cuenta de origen");
    if (has(input, "toAccountId")) next.toAccountId = requireName(input.toAccountId, "La cuenta de destino");
    validateTransfer(db, next);
    Object.assign(row, next);
    return expandTransfer(db, row, computeBalances(db));
  });
}

export async function deleteTransfer(id: string): Promise<{ deleted: boolean }> {
  return mutate((db) => {
    const before = db.transfers.length;
    db.transfers = db.transfers.filter((t) => t.id !== id);
    if (db.transfers.length === before) throw new NotFoundError("Transferencia");
    return { deleted: true };
  });
}

// ---------- Estadísticas ----------

function monthTotals(db: Database, ref: Date) {
  const from = startOfMonth(ref).getTime();
  const to = endOfMonth(ref).getTime();
  let income = 0;
  let expense = 0;
  for (const t of db.transactions) {
    const time = new Date(t.date).getTime();
    if (time < from || time > to) continue;
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  }
  return { income: round2(income), expense: round2(expense) };
}

export async function getSummary(): Promise<StatsSummary> {
  const db = await getDb();
  const balances = computeBalances(db);
  const active = db.accounts.filter((a) => !a.archived);
  const totalBalance = active.reduce((sum, a) => sum + (balances.get(a.id) ?? 0), 0);
  const now = new Date();
  const current = monthTotals(db, now);
  const previous = monthTotals(db, new Date(now.getFullYear(), now.getMonth() - 1, 1));
  return {
    totalBalance: round2(totalBalance),
    monthIncome: current.income,
    monthExpense: current.expense,
    prevMonthIncome: previous.income,
    prevMonthExpense: previous.expense,
    accountsCount: active.length,
  };
}

export async function getTrend(months = 6): Promise<TrendPoint[]> {
  const db = await getDb();
  const now = new Date();
  const from = startOfMonth(new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)).getTime();
  const buckets = new Map<string, { income: number; expense: number }>();
  for (let i = 0; i < months; i++) {
    buckets.set(monthKey(new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)), {
      income: 0,
      expense: 0,
    });
  }
  for (const t of db.transactions) {
    const d = new Date(t.date);
    if (d.getTime() < from) continue;
    const bucket = buckets.get(monthKey(d));
    if (!bucket) continue;
    if (t.type === "income") bucket.income += t.amount;
    else bucket.expense += t.amount;
  }
  return Array.from(buckets.entries()).map(([month, v]) => ({
    month,
    income: round2(v.income),
    expense: round2(v.expense),
  }));
}

export async function getByCategory(type: string, from?: string, to?: string): Promise<CategoryBreakdown[]> {
  const db = await getDb();
  const now = new Date();
  const fromT = (from ? new Date(from) : startOfMonth(now)).getTime();
  const toT = (to ? new Date(to) : endOfMonth(now)).getTime();
  const byCategory = new Map<string, CategoryBreakdown>();
  for (const t of db.transactions) {
    if (t.type !== type) continue;
    const time = new Date(t.date).getTime();
    if (time < fromT || time > toT) continue;
    const key = t.categoryId || "sin-categoria";
    const existing = byCategory.get(key);
    if (existing) {
      existing.total += t.amount;
    } else {
      const c = t.categoryId ? db.categories.find((x) => x.id === t.categoryId) : undefined;
      byCategory.set(key, {
        name: c?.name || "Sin categoría",
        color: c?.color || "#8A7A6D",
        icon: c?.icon || "tag",
        total: t.amount,
      });
    }
  }
  return Array.from(byCategory.values())
    .map((c) => ({ ...c, total: round2(c.total) }))
    .sort((a, b) => b.total - a.total);
}

// Gasto del mes actual frente al presupuesto de cada categoría que tenga uno.
export async function getBudgets(): Promise<BudgetStatus[]> {
  const db = await getDb();
  const now = new Date();
  const fromT = startOfMonth(now).getTime();
  const toT = endOfMonth(now).getTime();
  const spent = new Map<string, number>();
  for (const t of db.transactions) {
    if (t.type !== "expense" || !t.categoryId) continue;
    const time = new Date(t.date).getTime();
    if (time < fromT || time > toT) continue;
    spent.set(t.categoryId, (spent.get(t.categoryId) ?? 0) + t.amount);
  }
  return db.categories
    .filter((c) => c.type === "expense" && c.budget)
    .map((c) => {
      const s = round2(spent.get(c.id) ?? 0);
      return { category: toCategory(c), budget: c.budget!, spent: s, ratio: s / c.budget! };
    })
    .sort((a, b) => b.ratio - a.ratio);
}
