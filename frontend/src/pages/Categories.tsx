import { useState } from "react";
import { Plus, Pencil, Trash2, Tags } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { CategoryForm } from "../components/forms/CategoryForm";
import { useCategories, useDeleteCategory } from "../hooks/queries";
import { getIcon } from "../utils/constants";
import type { Category, MovementType } from "../types";

function CategoryGroup({
  title,
  categories,
  onEdit,
  onDelete,
}: {
  title: string;
  categories: Category[];
  onEdit: (c: Category) => void;
  onDelete: (c: Category) => void;
}) {
  return (
    <Card>
      <h2 className="font-semibold text-ink mb-4">{title}</h2>
      {categories.length === 0 ? (
        <p className="text-sm text-ink-soft">Sin categorías todavía.</p>
      ) : (
        <ul className="space-y-1">
          {categories.map((c) => {
            const Icon = getIcon(c.icon);
            return (
              <li
                key={c.id}
                className="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-cream-dark/50 transition-colors"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${c.color}1A`, color: c.color }}
                >
                  <Icon size={16} />
                </div>
                <span className="text-sm text-ink flex-1 truncate">{c.name}</span>
                <div className="hidden sm:flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onEdit(c)}
                    className="p-1.5 rounded-lg text-ink-soft hover:bg-cream-dark"
                    aria-label="Editar categoría"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => onDelete(c)}
                    className="p-1.5 rounded-lg text-negative hover:bg-negative/10"
                    aria-label="Eliminar categoría"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function Categories() {
  const { data: categories = [], isLoading } = useCategories();
  const deleteMutation = useDeleteCategory();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | undefined>(undefined);
  const [defaultType, setDefaultType] = useState<MovementType>("expense");

  function openCreate(type: MovementType) {
    setEditing(undefined);
    setDefaultType(type);
    setModalOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setModalOpen(true);
  }

  async function handleDelete(category: Category) {
    if (!confirm(`¿Eliminar la categoría "${category.name}"?`)) return;
    await deleteMutation.mutateAsync(category.id);
  }

  const income = categories.filter((c) => c.type === "income");
  const expense = categories.filter((c) => c.type === "expense");

  return (
    <div>
      <PageHeader
        title="Categorías"
        subtitle="Organiza tus ingresos y gastos"
        action={
          <Button onClick={() => openCreate("expense")}>
            <Plus size={16} />
            Nueva categoría
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-64 rounded-2xl bg-cream-dark/60 animate-pulse" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <Card>
          <EmptyState
            icon={Tags}
            title="Sin categorías todavía"
            description="Crea categorías para clasificar tus movimientos."
            action={
              <Button onClick={() => openCreate("expense")}>
                <Plus size={16} />
                Crear categoría
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CategoryGroup title="Gastos" categories={expense} onEdit={openEdit} onDelete={handleDelete} />
          <CategoryGroup title="Ingresos" categories={income} onEdit={openEdit} onDelete={handleDelete} />
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar categoría" : "Nueva categoría"}>
        <CategoryForm category={editing} defaultType={defaultType} onClose={() => setModalOpen(false)} />
      </Modal>
    </div>
  );
}
