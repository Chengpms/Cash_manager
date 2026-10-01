import { useState } from "react";
import { Plus, ArrowLeftRight, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { TransferForm } from "../components/forms/TransferForm";
import { useDeleteTransfer, useTransfers } from "../hooks/queries";
import { formatCurrency, formatDay } from "../utils/format";
import type { Transfer } from "../types";

export function Transfers() {
  const { data: transfers = [], isLoading } = useTransfers();
  const deleteMutation = useDeleteTransfer();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transfer | undefined>(undefined);

  function openCreate() {
    setEditing(undefined);
    setModalOpen(true);
  }

  function openEdit(t: Transfer) {
    setEditing(t);
    setModalOpen(true);
  }

  async function handleDelete(t: Transfer) {
    if (!confirm("¿Eliminar esta transferencia?")) return;
    await deleteMutation.mutateAsync(t.id);
  }

  return (
    <div>
      <PageHeader
        title="Transferencias"
        subtitle="Mueve dinero entre tus cuentas"
        action={
          <Button onClick={openCreate}>
            <Plus size={16} />
            Nueva transferencia
          </Button>
        }
      />

      <Card>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-cream-dark/60 animate-pulse" />
            ))}
          </div>
        ) : transfers.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="Sin transferencias todavía"
            description="Registra movimientos de dinero entre tus propias cuentas."
            action={
              <Button onClick={openCreate}>
                <Plus size={16} />
                Nueva transferencia
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {transfers.map((t) => (
              <li key={t.id} className="group flex items-center gap-3 py-3">
                <div className="w-10 h-10 rounded-xl bg-gold/10 text-gold-dark flex items-center justify-center shrink-0">
                  <ArrowLeftRight size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink truncate">
                    {t.fromAccount?.name} <span className="text-ink-faint">→</span> {t.toAccount?.name}
                  </p>
                  <p className="text-xs text-ink-soft truncate">
                    {t.description ? `${t.description} · ` : ""}
                    {formatDay(t.date)}
                  </p>
                </div>
                <span className="text-sm font-semibold text-ink shrink-0">{formatCurrency(t.amount)}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 hover-reveal transition-opacity shrink-0">
                  <button
                    onClick={() => openEdit(t)}
                    className="p-1.5 rounded-lg text-ink-soft hover:bg-cream-dark"
                    aria-label="Editar transferencia"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(t)}
                    className="p-1.5 rounded-lg text-negative hover:bg-negative/10"
                    aria-label="Eliminar transferencia"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar transferencia" : "Nueva transferencia"}
      >
        <TransferForm key={editing?.id ?? "new"} transfer={editing} onClose={() => setModalOpen(false)} />
      </Modal>
    </div>
  );
}
