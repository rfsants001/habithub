import { useState } from "react";
import { api, ApiError, type Category } from "../api/client";

export function HabitForm({
  categories,
  onCreated,
}: {
  categories: Category[];
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.SubmitEvent) {
    event.preventDefault();

    if (categoryId === "") return;

    setError(null);
    setSaving(true);

    try {
      await api.createHabit({ name, categoryId });
      setName("");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha de conexão");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ex: Meditar"
      />
      <select
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

      <button disabled={saving || categoryId === ""}>
        {saving ? "Salvando..." : "Criar Hábito"}
      </button>

      {error && <p role="alert">{error}</p>}
    </form>
  );
}
