import { FormEvent, useState } from "react";
import clsx from "clsx";
import { Plus, X } from "lucide-react";
import { FormField, inputClasses } from "../ui/FormField";
import { Button } from "../ui/Button";
import { toInputDate } from "../../utils/format";
import { IconColorPicker } from "../ui/IconColorPicker";
import {
  useAccounts,
  useCategories,
  useCreateCategory,
  useCreateTransaction,
  useUpdateTransaction,
} from "../../hooks/queries";
import { COLOR_OPTIONS, ICON_OPTIONS } from "../../utils/constants";
import type { MovementType, Transaction } from "../../types";

interface TransactionFormProps {
  transaction?: Transaction;
  defaultType?: MovementType;
  onClose: () => void;
}

export function TransactionForm({ transaction, defaultType = "expense", onClose }: TransactionFormProps) {
  const [type, setType] = useState<MovementType>(transaction?.type || defaultType);
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : "");
  const [accountId, setAccountId] = useState(transaction?.accountId || "");
  const [categoryId, setCategoryId] = useState(transaction?.categoryId || "");
  const [description, setDescription] = useState(transaction?.description || "");
  const [date, setDate] = useState(toInputDate(transaction?.date));
  const [error, setError] = useState<string | null>(null);

  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("tag");
  const [newCategoryColor, setNewCategoryColor] = useState(COLOR_OPTIONS[0]);
  const [newCategoryError, setNewCategoryError] = useState<string | null>(null);

  const { data: activeAccounts = [] } = useAccounts();
  // Al editar un movimiento de una cuenta archivada, esa cuenta sigue apareciendo
  const accounts =
    transaction?.account && !activeAccounts.some((a) => a.id === transaction.accountId)
      ? [...activeAccounts, transaction.account]
      : activeAccounts;
  const { data: categories = [] } = useCategories(type);
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const createCategoryMutation = useCreateCategory();

  const isSaving = createMutation.isPending || updateMutation.isPending;

  function openNewCategory() {
    setNewCategoryName("");
    setNewCategoryIcon("tag");
    setNewCategoryColor(COLOR_OPTIONS[0]);
    setNewCategoryError(null);
    setShowNewCategory(true);
  }

  async function handleCreateCategory() {
    setNewCategoryError(null);
    if (!newCategoryName.trim()) {
      setNewCategoryError("Ponle un nombre a la categoría");
      return;
    }
    try {
      const created = await createCategoryMutation.mutateAsync({
        name: newCategoryName.trim(),
        type,
        icon: newCategoryIcon,
        color: newCategoryColor,
      });
      setCategoryId(created.id);
      setShowNewCategory(false);
    } catch (err: any) {
      setNewCategoryError(err.message || "No se pudo crear la categoría");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const amountNum = parseFloat(amount.replace(",", "."));
    if (!amountNum || amountNum <= 0) {
      setError("Introduce un importe válido");
      return;
    }
    if (!date || isNaN(new Date(date).getTime())) {
      setError("Introduce una fecha válida");
      return;
    }
    if (!accountId) {
      setError("Selecciona una cuenta");
      return;
    }

    const payload = {
      amount: amountNum,
      type,
      accountId,
      categoryId: categoryId || null,
      description: description || null,
      date: new Date(date).toISOString(),
    };

    try {
      if (transaction) {
        await updateMutation.mutateAsync({ id: transaction.id, data: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "No se pudo guardar el movimiento");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-2 mb-5">
        <button
          type="button"
          onClick={() => {
            setType("expense");
            setCategoryId("");
          }}
          className={clsx(
            "rounded-xl py-2.5 text-sm font-medium border transition-colors",
            type === "expense"
              ? "bg-negative/10 border-negative text-negative"
              : "bg-white border-border text-ink-soft"
          )}
        >
          Gasto
        </button>
        <button
          type="button"
          onClick={() => {
            setType("income");
            setCategoryId("");
          }}
          className={clsx(
            "rounded-xl py-2.5 text-sm font-medium border transition-colors",
            type === "income"
              ? "bg-positive/10 border-positive text-positive"
              : "bg-white border-border text-ink-soft"
          )}
        >
          Ingreso
        </button>
      </div>

      <FormField label="Importe">
        <input
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          className={inputClasses}
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
        />
      </FormField>

      <FormField label="Cuenta">
        <select className={inputClasses} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">Selecciona una cuenta</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </FormField>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="block text-xs font-medium text-ink-soft">Categoría</span>
          {!showNewCategory && (
            <button
              type="button"
              onClick={openNewCategory}
              className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-dark"
            >
              <Plus size={12} />
              Nueva categoría
            </button>
          )}
        </div>

        {!showNewCategory ? (
          <select className={inputClasses} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="rounded-xl border border-border bg-cream-soft p-3.5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-ink-soft">
                Nueva categoría de {type === "income" ? "ingreso" : "gasto"}
              </span>
              <button
                type="button"
                onClick={() => setShowNewCategory(false)}
                className="p-1 rounded-lg text-ink-soft hover:bg-cream-dark"
                aria-label="Cancelar nueva categoría"
              >
                <X size={14} />
              </button>
            </div>

            <input
              type="text"
              className={clsx(inputClasses, "mb-3")}
              placeholder="Ej. Suscripciones"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              autoFocus
            />

            <IconColorPicker
              icons={ICON_OPTIONS}
              colors={COLOR_OPTIONS}
              icon={newCategoryIcon}
              color={newCategoryColor}
              onIconChange={setNewCategoryIcon}
              onColorChange={setNewCategoryColor}
            />

            {newCategoryError && <p className="text-xs text-negative mt-2">{newCategoryError}</p>}

            <div className="flex justify-end gap-2 mt-3">
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowNewCategory(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleCreateCategory}
                disabled={createCategoryMutation.isPending}
              >
                {createCategoryMutation.isPending ? "Creando..." : "Crear y usar"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <FormField label="Descripción (opcional)">
        <input
          type="text"
          className={inputClasses}
          placeholder="Ej. Compra semanal"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </FormField>

      <FormField label="Fecha">
        <input
          type="date"
          className={inputClasses}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </FormField>

      {error && <p className="text-sm text-negative mb-3">{error}</p>}

      <div className="flex justify-end gap-2 mt-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Guardando..." : transaction ? "Guardar cambios" : "Añadir movimiento"}
        </Button>
      </div>
    </form>
  );
}
