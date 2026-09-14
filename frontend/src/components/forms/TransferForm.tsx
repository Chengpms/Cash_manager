import { FormEvent, useState } from "react";
import { FormField, inputClasses } from "../ui/FormField";
import { Button } from "../ui/Button";
import { useAccounts, useCreateTransfer } from "../../hooks/queries";

interface TransferFormProps {
  onClose: () => void;
}

function toInputDate(value?: string) {
  const d = value ? new Date(value) : new Date();
  return d.toISOString().slice(0, 10);
}

export function TransferForm({ onClose }: TransferFormProps) {
  const { data: accounts = [] } = useAccounts();
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(toInputDate());
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateTransfer();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const amountNum = parseFloat(amount);
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
      await createMutation.mutateAsync({
        amount: amountNum,
        fromAccountId,
        toAccountId,
        description: description || null,
        date: new Date(date).toISOString(),
      });
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
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Guardando..." : "Transferir"}
        </Button>
      </div>
    </form>
  );
}
