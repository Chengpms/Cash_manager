import { useState } from "react";
import { Plus, Landmark } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { AccountCard } from "../components/accounts/AccountCard";
import { AccountForm } from "../components/forms/AccountForm";
import { useAccounts, useDeleteAccount } from "../hooks/queries";
import type { Account } from "../types";

export function Accounts() {
  const { data: accounts = [], isLoading } = useAccounts();
  const deleteMutation = useDeleteAccount();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | undefined>(undefined);

  function openCreate() {
    setEditing(undefined);
    setModalOpen(true);
  }

  function openEdit(account: Account) {
    setEditing(account);
    setModalOpen(true);
  }

  async function handleDelete(account: Account) {
    if (!confirm(`¿Eliminar la cuenta "${account.name}"? Si tiene movimientos, se archivará en su lugar.`)) return;
    await deleteMutation.mutateAsync(account.id);
  }

  return (
    <div>
      <PageHeader
        title="Cuentas"
        subtitle="Gestiona tus cuentas bancarias, efectivo e inversiones"
        action={
          <Button onClick={openCreate}>
            <Plus size={16} />
            Nueva cuenta
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-cream-dark/60 animate-pulse" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <EmptyState
            icon={Landmark}
            title="Sin cuentas todavía"
            description="Crea tu primera cuenta para empezar a registrar ingresos y gastos."
            action={
              <Button onClick={openCreate}>
                <Plus size={16} />
                Crear cuenta
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              onEdit={() => openEdit(a)}
              onDelete={() => handleDelete(a)}
            />
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar cuenta" : "Nueva cuenta"}>
        <AccountForm account={editing} onClose={() => setModalOpen(false)} />
      </Modal>
    </div>
  );
}
