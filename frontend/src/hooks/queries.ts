import { useEffect } from "react";
import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/client";
import type { Account, Category, Transaction, TransactionFilters, Transfer } from "../types";

// Los datos son locales y las consultas instantáneas, así que tras cualquier
// cambio se refresca todo: es más simple y evita pantallas desactualizadas
// (p. ej. renombrar una categoría también cambia la lista de movimientos).
function invalidateAll(qc: QueryClient) {
  qc.invalidateQueries();
  scheduleGooglePush(qc);
}

function useDataMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => invalidateAll(qc) });
}

// ---------- Cuentas ----------
export function useAccounts() {
  return useQuery({ queryKey: ["accounts"], queryFn: api.getAccounts });
}

export function useArchivedAccounts() {
  return useQuery({ queryKey: ["accounts", "archived"], queryFn: api.getArchivedAccounts });
}

export function useCreateAccount() {
  return useDataMutation((data: Partial<Account>) => api.createAccount(data));
}

export function useUpdateAccount() {
  return useDataMutation(({ id, data }: { id: string; data: Partial<Account> }) => api.updateAccount(id, data));
}

export function useDeleteAccount() {
  return useDataMutation((id: string) => api.deleteAccount(id));
}

export function useRestoreAccount() {
  return useDataMutation((id: string) => api.restoreAccount(id));
}

// ---------- Categorías ----------
export function useCategories(type?: string) {
  return useQuery({ queryKey: ["categories", type], queryFn: () => api.getCategories(type) });
}

export function useCreateCategory() {
  return useDataMutation((data: Partial<Category>) => api.createCategory(data));
}

export function useUpdateCategory() {
  return useDataMutation(({ id, data }: { id: string; data: Partial<Category> }) => api.updateCategory(id, data));
}

export function useDeleteCategory() {
  return useDataMutation((id: string) => api.deleteCategory(id));
}

// ---------- Transacciones ----------
export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({ queryKey: ["transactions", filters], queryFn: () => api.getTransactions(filters) });
}

export function useCreateTransaction() {
  return useDataMutation((data: Partial<Transaction>) => api.createTransaction(data));
}

export function useUpdateTransaction() {
  return useDataMutation(({ id, data }: { id: string; data: Partial<Transaction> }) =>
    api.updateTransaction(id, data)
  );
}

export function useDeleteTransaction() {
  return useDataMutation((id: string) => api.deleteTransaction(id));
}

// ---------- Transferencias ----------
export function useTransfers(limit?: number) {
  return useQuery({ queryKey: ["transfers", limit], queryFn: () => api.getTransfers(limit) });
}

export function useCreateTransfer() {
  return useDataMutation((data: Partial<Transfer>) => api.createTransfer(data));
}

export function useUpdateTransfer() {
  return useDataMutation(({ id, data }: { id: string; data: Partial<Transfer> }) => api.updateTransfer(id, data));
}

export function useDeleteTransfer() {
  return useDataMutation((id: string) => api.deleteTransfer(id));
}

// ---------- Estadísticas ----------
export function useSummary() {
  return useQuery({ queryKey: ["summary"], queryFn: api.getSummary });
}

export function useTrend(months = 6) {
  return useQuery({ queryKey: ["trend", months], queryFn: () => api.getTrend(months) });
}

export function useByCategory(type: string, from?: string, to?: string) {
  return useQuery({ queryKey: ["by-category", type, from, to], queryFn: () => api.getByCategory(type, from, to) });
}

export function useBudgets() {
  return useQuery({ queryKey: ["budgets"], queryFn: api.getBudgets });
}

// ---------- Google Drive / Sheets ----------
export function useGoogleStatus() {
  return useQuery({ queryKey: ["google-status"], queryFn: api.getGoogleStatus, enabled: api.googleAvailable });
}

export function useConnectGoogle() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.connectGoogle, onSuccess: () => qc.invalidateQueries() });
}

export function useSyncGoogle() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.syncGoogle, onSuccess: () => qc.invalidateQueries() });
}

// Importa los cambios hechos a mano en la hoja de cálculo. Con
// allowDeletes:true también borra en la app lo que se haya borrado en la hoja.
export function useImportGoogle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: { allowDeletes?: boolean } = {}) => api.importGoogle(opts),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useDisconnectGoogle() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.disconnectGoogle, onSuccess: () => qc.invalidateQueries() });
}

// Sincronización en segundo plano mientras la app está abierta y conectada:
// cada ~45 s sube los cambios locales pendientes o, si no hay, trae los
// cambios hechos en la hoja (sin borrar nada). Además, unos segundos después
// de cada cambio local se sube automáticamente.
const AUTO_SYNC_INTERVAL_MS = 45_000;
const PUSH_DELAY_MS = 4_000;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let ticking = false;

async function runTick(qc: QueryClient) {
  if (ticking || !api.googleAvailable) return;
  ticking = true;
  try {
    const result = await api.googleAutoSyncTick();
    if (result !== "skipped") qc.invalidateQueries();
  } catch {
    // Silencioso: sin conexión, token caducado... se reintenta en el siguiente ciclo
    qc.invalidateQueries({ queryKey: ["google-status"] });
  } finally {
    ticking = false;
  }
}

function scheduleGooglePush(qc: QueryClient) {
  if (!api.googleAvailable) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    runTick(qc);
  }, PUSH_DELAY_MS);
}

export function useGoogleAutoSync() {
  const { data: status } = useGoogleStatus();
  const qc = useQueryClient();
  const connected = status?.connected === true;

  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(() => runTick(qc), AUTO_SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [connected, qc]);
}
