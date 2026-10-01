import * as service from "../data/service";
import * as google from "../data/google";

// Capa de acceso a datos usada por los hooks de React Query. Antes hacía
// peticiones HTTP a un backend Express; ahora todo se ejecuta dentro de la app
// sobre la base de datos local, así que funciona sin servidor en escritorio y
// en Android.

// Cuentas
export const getAccounts = () => service.getAccounts();
export const getArchivedAccounts = () => service.getAccounts({ archived: true });
export const createAccount = service.createAccount;
export const updateAccount = service.updateAccount;
export const deleteAccount = service.deleteAccount;
export const restoreAccount = service.restoreAccount;

// Categorías
export const getCategories = service.getCategories;
export const createCategory = service.createCategory;
export const updateCategory = service.updateCategory;
export const deleteCategory = service.deleteCategory;

// Transacciones
export const getTransactions = service.getTransactions;
export const createTransaction = service.createTransaction;
export const updateTransaction = service.updateTransaction;
export const deleteTransaction = service.deleteTransaction;

// Transferencias
export const getTransfers = service.getTransfers;
export const createTransfer = service.createTransfer;
export const updateTransfer = service.updateTransfer;
export const deleteTransfer = service.deleteTransfer;

// Estadísticas
export const getSummary = service.getSummary;
export const getTrend = service.getTrend;
export const getByCategory = service.getByCategory;
export const getBudgets = service.getBudgets;

// Google Drive / Sheets (solo escritorio)
export const googleAvailable = google.googleAvailable;
export const connectGoogle = google.connectGoogle;
export const getGoogleStatus = google.getGoogleStatus;
export const syncGoogle = google.syncToSheets;
export const importGoogle = (opts: { allowDeletes?: boolean } = {}) => google.importFromSheets(!!opts.allowDeletes);
export const disconnectGoogle = google.disconnectGoogle;
export const googleAutoSyncTick = google.autoSyncTick;
export const getGoogleCredentials = google.getGoogleCredentials;
export const saveGoogleCredentials = google.saveGoogleCredentials;
