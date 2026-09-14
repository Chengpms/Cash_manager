import { FormEvent, useState } from "react";
import { FormField, inputClasses } from "../ui/FormField";
import { Button } from "../ui/Button";
import { IconColorPicker } from "../ui/IconColorPicker";
import { useCreateAccount, useUpdateAccount } from "../../hooks/queries";
import { ACCOUNT_ICON_OPTIONS, ACCOUNT_TYPE_OPTIONS, COLOR_OPTIONS, CURRENCY_OPTIONS } from "../../utils/constants";
import type { Account, AccountType } from "../../types";

interface AccountFormProps {
  account?: Account;
  onClose: () => void;
}

export function AccountForm({ account, onClose }: AccountFormProps) {
  const [name, setName] = useState(account?.name || "");
  const [type, setType] = useState<AccountType>(account?.type || "checking");
  const [currency, setCurrency] = useState(account?.currency || "EUR");
  const [initialBalance, setInitialBalance] = useState(
    account ? String(account.initialBalance) : "0"
  );
  const [icon, setIcon] = useState(account?.icon || "wallet");
  const [color, setColor] = useState(account?.color || COLOR_OPTIONS[0]);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateAccount();
  const updateMutation = useUpdateAccount();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }

    const payload = {
      name: name.trim(),
      type,
      currency,
      initialBalance: parseFloat(initialBalance) || 0,
      icon,
      color,
    };

    try {
      if (account) {
        await updateMutation.mutateAsync({ id: account.id, data: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "No se pudo guardar la cuenta");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <FormField label="Nombre de la cuenta">
        <input
          type="text"
          className={inputClasses}
          placeholder="Ej. Cuenta principal"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Tipo">
          <select className={inputClasses} value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {ACCOUNT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Divisa">
          <select className={inputClasses} value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <FormField label={account ? "Balance inicial" : "Balance inicial (antes de registrar movimientos)"}>
        <input
          type="number"
          step="0.01"
          className={inputClasses}
          value={initialBalance}
          onChange={(e) => setInitialBalance(e.target.value)}
        />
      </FormField>

      <FormField label="Icono y color">
        <IconColorPicker
          icons={ACCOUNT_ICON_OPTIONS}
          colors={COLOR_OPTIONS}
          icon={icon}
          color={color}
          onIconChange={setIcon}
          onColorChange={setColor}
        />
      </FormField>

      {error && <p className="text-sm text-negative mb-3">{error}</p>}

      <div className="flex justify-end gap-2 mt-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Guardando..." : account ? "Guardar cambios" : "Crear cuenta"}
        </Button>
      </div>
    </form>
  );
}
