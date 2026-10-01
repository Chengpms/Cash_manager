import { useState } from "react";
import { Plus, Landmark, Archive, ArchiveRestore, ChevronDown } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { AccountCard } from "../components/accounts/AccountCard";
import { AccountForm } from "../components/forms/AccountForm";
import { useAccounts, useArchivedAccounts, useDeleteAccount, useRestoreAccount } from "../hooks/queries";
import { getIcon } from "../utils/constants";
import { formatCurrency } from "../utils/format";
import type { Account } from "../types";

export function Accounts() {
  const { data: accounts = [], isLoading } = useAccounts();
  const { data: archived = [] } = useArchivedAccounts();
  const deleteMutation = useDeleteAccount();
  const restoreMutation = useRestoreAccount();
  const [showArchived, setShowArchived] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
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
    const result = await deleteMutation.mutateAsync(account.id);
    setNotice(
      result.archived
        ? `"${account.name}" tenía movimientos, así que se ha archivado. Puedes restaurarla abajo.`
        : null
    );
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

      {notice && (
        <p className="mt-4 text-sm text-ink-soft bg-cream-soft border border-border rounded-xl px-3 py-2">{notice}</p>
      )}

      {archived.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-ink"
          >
            <Archive size={15} />
            Cuentas archivadas ({archived.length})
            <ChevronDown size={14} className={showArchived ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>
          {showArchived && (
            <Card className="mt-3">
              <ul className="divide-y divide-border">
                {archived.map((a) => {
                  const Icon = getIcon(a.icon);
                  return (
                    <li key={a.id} className="flex items-center gap-3 py-2.5">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 opacity-70"
                        style={{ backgroundColor: `${a.color}1A`, color: a.color }}
                      >
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink truncate">{a.name}</p>
                        <p className="text-xs text-ink-soft">{formatCurrency(a.balance, a.currency)}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={restoreMutation.isPending}
                        onClick={() => restoreMutation.mutate(a.id)}
                      >
                        <ArchiveRestore size={14} />
                        Restaurar
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar cuenta" : "Nueva cuenta"}>
        <AccountForm account={editing} onClose={() => setModalOpen(false)} />
      </Modal>
    </div>
  );
}
