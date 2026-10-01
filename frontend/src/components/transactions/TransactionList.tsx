import { ArrowDownLeft, ArrowUpRight, Pencil, Trash2, Receipt } from "lucide-react";
import { getIcon } from "../../utils/constants";
import { formatCurrency, formatDay, formatRelativeDay } from "../../utils/format";
import { EmptyState } from "../ui/EmptyState";
import type { Transaction } from "../../types";

interface TransactionListProps {
  transactions: Transaction[];
  isLoading?: boolean;
  showAccount?: boolean;
  relativeDates?: boolean;
  onEdit?: (t: Transaction) => void;
  onDelete?: (t: Transaction) => void;
}

export function TransactionList({
  transactions,
  isLoading,
  showAccount,
  relativeDates = true,
  onEdit,
  onDelete,
}: TransactionListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-cream-dark/60 animate-pulse" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="Sin movimientos todavía"
        description="Registra tu primer ingreso o gasto para verlo aquí."
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {transactions.map((t) => {
        const Icon = getIcon(t.category?.icon);
        const isIncome = t.type === "income";
        return (
          <li key={t.id} className="group flex items-center gap-3 py-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: `${t.category?.color || "#8A7863"}1A`,
                color: t.category?.color || "#8A7863",
              }}
            >
              <Icon size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink truncate">
                {t.description || t.category?.name || (isIncome ? "Ingreso" : "Gasto")}
              </p>
              <p className="text-xs text-ink-soft truncate">
                {showAccount && t.account ? `${t.account.name} · ` : ""}
                {relativeDates ? formatRelativeDay(t.date) : formatDay(t.date)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`inline-flex items-center gap-1 text-sm font-semibold ${
                  isIncome ? "text-positive" : "text-negative"
                }`}
              >
                {isIncome ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                {isIncome ? "+" : "-"}
                {formatCurrency(t.amount, t.account?.currency)}
              </span>
              {(onEdit || onDelete) && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 hover-reveal transition-opacity">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(t)}
                      className="p-1.5 rounded-lg text-ink-soft hover:bg-cream-dark"
                      aria-label="Editar"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(t)}
                      className="p-1.5 rounded-lg text-negative hover:bg-negative/10"
                      aria-label="Eliminar"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
