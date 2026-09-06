import { useState } from "react";
import { api, ApiError, type Category } from "../api/client";

export function CategoryForm({
  editing,
  onSaved,
  onClose,
}: {
  editing: Category | null;
  onSaved: (message: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [color, setColor] = useState(editing?.color ?? "#3fb950");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      if (editing) {
        await api.updateCategory(editing.id, { name, color });
        onSaved("Categoria atualizada");
      } else {
        await api.createCategory({ name, color });
        onSaved("Categoria criada");
      }
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha de conexão");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="category-name">Nome</label>
      <input
        id="category-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ex: Saúde"
      />

      <label htmlFor="category-color">Cor</label>
      <div className="color-field">
        <input
          id="category-color"
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
        <span className="swatch" style={{ background: color }} />
        <code>{color}</code>
      </div>

      {error && <p role="alert">{error}</p>}

      <div className="modal-actions">
        <button type="button" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
        <button disabled={saving}>
          {saving
            ? "Salvando…"
            : editing
              ? "Salvar alterações"
              : "Cadastrar categoria"}
        </button>
      </div>
    </form>
  );
}
