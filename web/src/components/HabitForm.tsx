import { useState } from "react";
import { api, ApiError, type Category, type Habit } from "../api/client";

export function HabitForm({
  categories,
  editing,
  onSaved,
  onClose,
}: {
  categories: Category[];
  editing: Habit | null;
  onSaved: (message: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [categoryId, setCategoryId] = useState<number | "">(
    editing?.categoryId ?? categories[0]?.id ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (categoryId === "") return;

    setError(null);
    setSaving(true);

    try {
      if (editing) {
        await api.updateHabit(editing.id, { name, categoryId });
        onSaved("Hábito atualizado");
      } else {
        await api.createHabit({ name, categoryId });
        onSaved("Hábito criado");
      }
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha de conexão");
    } finally {
      setSaving(false);
    }
  }

  if (categories.length === 0) {
    return (
      <div className="form-empty">
        <p>
          Todo hábito mora dentro de uma categoria, e você ainda não tem
          nenhuma.
        </p>
        <p className="tagline">
          Feche aqui e use o <strong>+</strong> para cadastrar uma categoria
          primeiro.
        </p>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Entendi
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="habit-name">Nome</label>
      <input
        id="habit-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ex: Meditar"
      />

      <label htmlFor="habit-category">Categoria</label>
      <select
        id="habit-category"
        value={categoryId}
        onChange={(e) => setCategoryId(Number(e.target.value))}
      >
        <option value="" disabled>
          Escolha uma categoria
        </option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>

      {error && <p role="alert">{error}</p>}

      <div className="modal-actions">
        <button type="button" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
        <button disabled={saving || categoryId === ""}>
          {saving
            ? "Salvando…"
            : editing
              ? "Salvar alterações"
              : "Cadastrar hábito"}
        </button>
      </div>
    </form>
  );
}
