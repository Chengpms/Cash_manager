import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/client";
import type { Account, Category, Transaction, TransactionFilters, Transfer } from "../types";

// ---------- Cuentas ----------
export function useAccounts() {
  return useQuery({ queryKey: ["accounts"], queryFn: api.getAccounts });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Account>) => api.createAccount(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Account> }) => api.updateAccount(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteAccount(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

// ---------- Categorías ----------
export function useCategories(type?: string) {
  return useQuery({ queryKey: ["categories", type], queryFn: () => api.getCategories(type) });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Category>) => api.createCategory(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Category> }) => api.updateCategory(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

// ---------- Transacciones ----------
function invalidateMoneyRelated(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["transactions"] });
  qc.invalidateQueries({ queryKey: ["accounts"] });
  qc.invalidateQueries({ queryKey: ["summary"] });
  qc.invalidateQueries({ queryKey: ["trend"] });
  qc.invalidateQueries({ queryKey: ["by-category"] });
}

export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({ queryKey: ["transactions", filters], queryFn: () => api.getTransactions(filters) });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Transaction>) => api.createTransaction(data),
    onSuccess: () => invalidateMoneyRelated(qc),
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Transaction> }) => api.updateTransaction(id, data),
    onSuccess: () => invalidateMoneyRelated(qc),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTransaction(id),
    onSuccess: () => invalidateMoneyRelated(qc),
  });
}

// ---------- Transferencias ----------
export function useTransfers(limit?: number) {
  return useQuery({ queryKey: ["transfers", limit], queryFn: () => api.getTransfers(limit) });
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Transfer>) => api.createTransfer(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transfers"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    },
  });
}

export function useDeleteTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTransfer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transfers"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    },
  });
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

// ---------- Google Drive / Sheets ----------
export function useGoogleStatus() {
  return useQuery({ queryKey: ["google-status"], queryFn: api.getGoogleStatus, staleTime: 10_000 });
}

export function useSyncGoogle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.syncGoogle,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["google-status"] }),
  });
}

function invalidateEverythingAfterImport(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["accounts"] });
  qc.invalidateQueries({ queryKey: ["categories"] });
  qc.invalidateQueries({ queryKey: ["transactions"] });
  qc.invalidateQueries({ queryKey: ["transfers"] });
  qc.invalidateQueries({ queryKey: ["summary"] });
  qc.invalidateQueries({ queryKey: ["trend"] });
  qc.invalidateQueries({ queryKey: ["by-category"] });
  qc.invalidateQueries({ queryKey: ["google-status"] });
}

// Importa (una vez) los cambios hechos a mano en la hoja de cálculo. Con
// allowDeletes:true también borra en la app lo que se haya borrado en la hoja.
export function useImportGoogle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: { allowDeletes?: boolean } = {}) => api.importGoogle(opts),
    onSuccess: () => invalidateEverythingAfterImport(qc),
  });
}

// Revisa la hoja de cálculo en segundo plano mientras la app está abierta y
// conectada a Google, para que los cambios hechos directamente en el Sheet
// aparezcan en la app sin tener que pulsar nada. Nunca borra datos por su
// cuenta (allowDeletes: false) — para aplicar filas borradas en la hoja hay
// que usar el botón "Importar cambios" de Ajustes.
const AUTO_IMPORT_INTERVAL_MS = 45_000;

export function useGoogleAutoSync() {
  const { data: status } = useGoogleStatus();
  const qc = useQueryClient();
  const connected = status?.connected === true;

  useEffect(() => {
    if (!connected) return;

    let cancelled = false;
    const tick = () => {
      api
        .importGoogle({ allowDeletes: false })
        .then(() => {
          if (!cancelled) invalidateEverythingAfterImport(qc);
        })
        .catch(() => {
          // Sincronización silenciosa: si falla (sin conexión, token caducado, etc.)
          // simplemente se reintenta en el siguiente ciclo.
        });
    };

    const interval = setInterval(tick, AUTO_IMPORT_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);
}

export function useDisconnectGoogle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.disconnectGoogle,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["google-status"] }),
  });
}
