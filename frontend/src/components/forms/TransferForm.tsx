import { FormEvent, useState } from "react";
import { FormField, inputClasses } from "../ui/FormField";
import { Button } from "../ui/Button";
import { toInputDate } from "../../utils/format";
import { useAccounts, useCreateTransfer, useUpdateTransfer } from "../../hooks/queries";
import type { Transfer } from "../../types";

interface TransferFormProps {
  transfer?: Transfer;
  onClose: () => void;
}

export function TransferForm({ transfer, onClose }: TransferFormProps) {
  const { data: activeAccounts = [] } = useAccounts();
  const [fromAccountId, setFromAccountId] = useState(transfer?.fromAccountId || "");
  const [toAccountId, setToAccountId] = useState(transfer?.toAccountId || "");
  const [amount, setAmount] = useState(transfer ? String(transfer.amount) : "");
  const [description, setDescription] = useState(transfer?.description || "");
  const [date, setDate] = useState(toInputDate(transfer?.date));

  // Al editar, las cuentas ya archivadas de la transferencia siguen apareciendo
  const accounts = [...activeAccounts];
  for (const a of [transfer?.fromAccount, transfer?.toAccount]) {
    if (a && !accounts.some((x) => x.id === a.id)) accounts.push(a);
  }
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateTransfer();
  const updateMutation = useUpdateTransfer();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const amountNum = parseFloat(amount.replace(",", "."));
    if (!amountNum || amountNum <= 0) {
      setError("Introduce un importe válido");
      return;
    }
    if (!fromAccountId || !toAccountId) {
      setError("Selecciona ambas cuentas");
      return;
    }
    if (fromAccountId === toAccountId) {
      setError("La cuenta de origen y destino deben ser distintas");
      return;
    }

    try {
      if (!date || isNaN(new Date(date).getTime())) {
        setError("Introduce una fecha válida");
        return;
      }
      const payload = {
        amount: amountNum,
        fromAccountId,
        toAccountId,
        description: description || null,
        date: new Date(date).toISOString(),
      };
      if (transfer) await updateMutation.mutateAsync({ id: transfer.id, data: payload });
      else await createMutation.mutateAsync(payload);
      onClose();
    } catch (err: any) {
      setError(err.message || "No se pudo registrar la transferencia");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <FormField label="Desde">
        <select
          className={inputClasses}
          value={fromAccountId}
          onChange={(e) => setFromAccountId(e.target.value)}
        >
          <option value="">Cuenta de origen</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Hacia">
        <select className={inputClasses} value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
          <option value="">Cuenta de destino</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Importe">
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          className={inputClasses}
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </FormField>

      <FormField label="Descripción (opcional)">
        <input
          type="text"
          className={inputClasses}
          placeholder="Ej. Ahorro mensual"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </FormField>

      <FormField label="Fecha">
        <input type="date" className={inputClasses} value={date} onChange={(e) => setDate(e.target.value)} />
      </FormField>

      {error && <p className="text-sm text-negative mb-3">{error}</p>}

      <div className="flex justify-end gap-2 mt-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Guardando..." : transfer ? "Guardar cambios" : "Transferir"}
        </Button>
      </div>
    </form>
  );
}
