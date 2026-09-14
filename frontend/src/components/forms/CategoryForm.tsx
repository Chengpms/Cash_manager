import { FormEvent, useState } from "react";
import clsx from "clsx";
import { FormField, inputClasses } from "../ui/FormField";
import { Button } from "../ui/Button";
import { IconColorPicker } from "../ui/IconColorPicker";
import { useCreateCategory, useUpdateCategory } from "../../hooks/queries";
import { COLOR_OPTIONS, ICON_OPTIONS } from "../../utils/constants";
import type { Category, MovementType } from "../../types";

interface CategoryFormProps {
  category?: Category;
  defaultType?: MovementType;
  onClose: () => void;
}

export function CategoryForm({ category, defaultType = "expense", onClose }: CategoryFormProps) {
  const [name, setName] = useState(category?.name || "");
  const [type, setType] = useState<MovementType>(category?.type || defaultType);
  const [icon, setIcon] = useState(category?.icon || "tag");
  const [color, setColor] = useState(category?.color || COLOR_OPTIONS[0]);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }

    const payload = { name: name.trim(), type, icon, color };

    try {
      if (category) {
        await updateMutation.mutateAsync({ id: category.id, data: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "No se pudo guardar la categoría");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          type="button"
          onClick={() => setType("expense")}
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
          onClick={() => setType("income")}
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

      <FormField label="Nombre">
        <input
          type="text"
          className={inputClasses}
          placeholder="Ej. Alimentación"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </FormField>

      <FormField label="Icono y color">
        <IconColorPicker
          icons={ICON_OPTIONS}
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
          {isSaving ? "Guardando..." : category ? "Guardar cambios" : "Crear categoría"}
        </Button>
      </div>
    </form>
  );
}
