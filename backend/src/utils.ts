import { Account, Transaction, Transfer } from "@prisma/client";

/**
 * Calcula el balance actual de una cuenta a partir de su balance inicial,
 * sus transacciones (ingresos/gastos) y las transferencias entrantes/salientes.
 */
export function computeAccountBalance(
  account: Account,
  transactions: Transaction[],
  transfersOut: Transfer[],
  transfersIn: Transfer[]
): number {
  let balance = account.initialBalance;

  for (const t of transactions) {
    balance += t.type === "income" ? t.amount : -t.amount;
  }
  for (const t of transfersOut) {
    balance -= t.amount;
  }
  for (const t of transfersIn) {
    balance += t.amount;
  }

  return Math.round(balance * 100) / 100;
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}
