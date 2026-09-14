import type {
  Account,
  Category,
  CategoryBreakdown,
  GoogleImportResult,
  GoogleStatus,
  GoogleSyncResult,
  StatsSummary,
  Transaction,
  TransactionFilters,
  Transfer,
  TrendPoint,
} from "../types";

const BASE_URL = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

// Cuentas
export const getAccounts = () => request<Account[]>("/accounts");
export const createAccount = (data: Partial<Account>) =>
  request<Account>("/accounts", { method: "POST", body: JSON.stringify(data) });
export const updateAccount = (id: string, data: Partial<Account>) =>
  request<Account>(`/accounts/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteAccount = (id: string) => request<{ deleted?: boolean; archived?: boolean }>(`/accounts/${id}`, { method: "DELETE" });

// Categorías
export const getCategories = (type?: string) =>
  request<Category[]>(`/categories${buildQuery({ type })}`);
export const createCategory = (data: Partial<Category>) =>
  request<Category>("/categories", { method: "POST", body: JSON.stringify(data) });
export const updateCategory = (id: string, data: Partial<Category>) =>
  request<Category>(`/categories/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteCategory = (id: string) => request<{ deleted: boolean }>(`/categories/${id}`, { method: "DELETE" });

// Transacciones
export const getTransactions = (filters: TransactionFilters = {}) =>
  request<Transaction[]>(`/transactions${buildQuery(filters as Record<string, string | number | undefined>)}`);
export const createTransaction = (data: Partial<Transaction>) =>
  request<Transaction>("/transactions", { method: "POST", body: JSON.stringify(data) });
export const updateTransaction = (id: string, data: Partial<Transaction>) =>
  request<Transaction>(`/transactions/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteTransaction = (id: string) => request<{ deleted: boolean }>(`/transactions/${id}`, { method: "DELETE" });

// Transferencias
export const getTransfers = (limit?: number) => request<Transfer[]>(`/transfers${buildQuery({ limit })}`);
export const createTransfer = (data: Partial<Transfer>) =>
  request<Transfer>("/transfers", { method: "POST", body: JSON.stringify(data) });
export const deleteTransfer = (id: string) => request<{ deleted: boolean }>(`/transfers/${id}`, { method: "DELETE" });

// Estadísticas
export const getSummary = () => request<StatsSummary>("/stats/summary");
export const getTrend = (months = 6) => request<TrendPoint[]>(`/stats/trend${buildQuery({ months })}`);
export const getByCategory = (type: string, from?: string, to?: string) =>
  request<CategoryBreakdown[]>(`/stats/by-category${buildQuery({ type, from, to })}`);

// Google Drive / Sheets
export const getGoogleAuthUrl = () => request<{ url: string }>("/google/auth-url");
export const getGoogleStatus = () => request<GoogleStatus>("/google/status");
export const syncGoogle = () => request<GoogleSyncResult>("/google/sync", { method: "POST" });
export const importGoogle = (opts: { allowDeletes?: boolean } = {}) =>
  request<GoogleImportResult>("/google/import", {
    method: "POST",
    body: JSON.stringify({ allowDeletes: !!opts.allowDeletes }),
  });
export const disconnectGoogle = () => request<{ disconnected: boolean }>("/google/disconnect", { method: "POST" });
