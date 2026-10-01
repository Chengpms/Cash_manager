import { useMemo, useState } from "react";
import { Download, Plus, Search, X } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { TransactionList } from "../components/transactions/TransactionList";
import { TransactionForm } from "../components/forms/TransactionForm";
import { useAccounts, useCategories, useDeleteTransaction, useTransactions } from "../hooks/queries";
import { inputClasses } from "../components/ui/FormField";
import { exportTransactionsCsv } from "../data/backup";
import { formatCurrency } from "../utils/format";
import type { MovementType, Transaction, TransactionFilters } from "../types";

// Los movimientos se guardan a medianoche UTC del día elegido, así que el
// rango también se expresa en UTC para incluir completos el primer y último día.
function rangeStart(day: string) {
  return day ? `${day}T00:00:00.000Z` : undefined;
}
function rangeEnd(day: string) {
  return day ? `${day}T23:59:59.999Z` : undefined;
}

export function Transactions() {
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] = useState<MovementType | "">("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | undefined>(undefined);

  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const filters: TransactionFilters = {
    accountId: accountId || undefined,
    categoryId: categoryId || undefined,
    type: type || undefined,
    search: search || undefined,
    from: rangeStart(from),
    to: rangeEnd(to),
  };
  const { data: transactions = [], isLoading } = useTransactions(filters);
  const hasFilters = !!(accountId || categoryId || type || search || from || to);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
    }
    return { income, expense, net: income - expense };
  }, [transactions]);

  function clearFilters() {
    setAccountId("");
    setCategoryId("");
    setType("");
    setSearch("");
    setFrom("");
    setTo("");
  }

  async function handleExport() {
    setExportError(null);
    try {
      await exportTransactionsCsv(filters);
    } catch (err: any) {
      setExportError(err.message || "No se pudo exportar");
    }
  }
  const deleteMutation = useDeleteTransaction();

  function openCreate() {
    setEditing(undefined);
    setModalOpen(true);
  }

  function openEdit(t: Transaction) {
    setEditing(t);
    setModalOpen(true);
  }

  async function handleDelete(t: Transaction) {
    if (!confirm("¿Eliminar este movimiento?")) return;
    await deleteMutation.mutateAsync(t.id);
  }

  return (
    <div>
      <PageHeader
        title="Transacciones"
        subtitle="Todos tus ingresos y gastos"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleExport} disabled={transactions.length === 0}>
              <Download size={16} />
              <span className="hidden sm:inline">Exportar CSV</span>
            </Button>
            <Button onClick={openCreate}>
              <Plus size={16} />
              Nuevo movimiento
            </Button>
          </div>
        }
      />

      <Card className="mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              type="text"
              placeholder="Buscar..."
              className={`${inputClasses} pl-9`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className={inputClasses} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Todas las cuentas</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select className={inputClasses} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            className={inputClasses}
            value={type}
            onChange={(e) => setType(e.target.value as MovementType | "")}
          >
            <option value="">Ingresos y gastos</option>
            <option value="income">Solo ingresos</option>
            <option value="expense">Solo gastos</option>
          </select>
          <label className="flex items-center gap-2 text-xs text-ink-soft">
            <span className="w-10 shrink-0">Desde</span>
            <input type="date" className={inputClasses} value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-xs text-ink-soft">
            <span className="w-10 shrink-0">Hasta</span>
            <input type="date" className={inputClasses} value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-dark"
          >
            <X size={12} />
            Quitar filtros
          </button>
        )}
      </Card>

      {exportError && <p className="text-sm text-negative mb-3">{exportError}</p>}

      {transactions.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded-2xl bg-white border border-border p-3 shadow-soft">
            <p className="text-xs text-ink-soft">Ingresos</p>
            <p className="text-sm sm:text-base font-semibold text-positive truncate">{formatCurrency(totals.income)}</p>
          </div>
          <div className="rounded-2xl bg-white border border-border p-3 shadow-soft">
            <p className="text-xs text-ink-soft">Gastos</p>
            <p className="text-sm sm:text-base font-semibold text-negative truncate">{formatCurrency(totals.expense)}</p>
          </div>
          <div className="rounded-2xl bg-white border border-border p-3 shadow-soft">
            <p className="text-xs text-ink-soft">Neto · {transactions.length} movs.</p>
            <p className={`text-sm sm:text-base font-semibold truncate ${totals.net >= 0 ? "text-ink" : "text-negative"}`}>
              {formatCurrency(totals.net)}
            </p>
          </div>
        </div>
      )}

      <Card>
        <TransactionList
          transactions={transactions}
          isLoading={isLoading}
          showAccount
          relativeDates={false}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar movimiento" : "Nuevo movimiento"}
      >
        <TransactionForm transaction={editing} onClose={() => setModalOpen(false)} />
      </Modal>
    </div>
  );
}
