import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { TransactionList } from "../components/transactions/TransactionList";
import { TransactionForm } from "../components/forms/TransactionForm";
import { useAccounts, useCategories, useDeleteTransaction, useTransactions } from "../hooks/queries";
import { inputClasses } from "../components/ui/FormField";
import type { MovementType, Transaction } from "../types";

export function Transactions() {
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] = useState<MovementType | "">("");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | undefined>(undefined);

  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: transactions = [], isLoading } = useTransactions({
    accountId: accountId || undefined,
    categoryId: categoryId || undefined,
    type: type || undefined,
    search: search || undefined,
  });
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
          <Button onClick={openCreate}>
            <Plus size={16} />
            Nuevo movimiento
          </Button>
        }
      />

      <Card className="mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
        </div>
      </Card>

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
