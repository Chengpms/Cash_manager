export type AccountType = "checking" | "savings" | "cash" | "credit" | "investment";
export type MovementType = "income" | "expense";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  color: string;
  icon: string;
  initialBalance: number;
  balance: number;
  archived: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: MovementType;
  color: string;
  icon: string;
  // Presupuesto mensual (solo categorías de gasto)
  budget: number | null;
}

export interface Transaction {
  id: string;
  amount: number;
  type: MovementType;
  description: string | null;
  date: string;
  accountId: string;
  account?: Account;
  categoryId: string | null;
  category?: Category | null;
}

export interface Transfer {
  id: string;
  amount: number;
  description: string | null;
  date: string;
  fromAccountId: string;
  fromAccount?: Account;
  toAccountId: string;
  toAccount?: Account;
}

export interface StatsSummary {
  totalBalance: number;
  monthIncome: number;
  monthExpense: number;
  prevMonthIncome: number;
  prevMonthExpense: number;
  accountsCount: number;
}

export interface BudgetStatus {
  category: Category;
  budget: number;
  spent: number;
  ratio: number;
}

export interface TrendPoint {
  month: string;
  income: number;
  expense: number;
}

export interface CategoryBreakdown {
  name: string;
  color: string;
  icon: string;
  total: number;
}

export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  type?: MovementType;
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
}

export type GoogleStatus =
  | { connected: false }
  | {
      connected: true;
      email: string;
      spreadsheetUrl: string | null;
      lastSyncedAt: string | null;
      pendingPush: boolean;
    };

export interface GoogleSyncResult {
  spreadsheetUrl: string;
  lastSyncedAt: string;
}

export interface GoogleImportCounts {
  accounts: number;
  categories: number;
  transactions: number;
  transfers: number;
}

export interface GoogleImportResult {
  spreadsheetUrl: string;
  lastSyncedAt: string;
  created: GoogleImportCounts;
  updated: GoogleImportCounts;
  deleted: GoogleImportCounts;
  warnings: string[];
}
