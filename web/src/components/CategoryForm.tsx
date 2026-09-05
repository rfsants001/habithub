import { useState } from "react";
import { api, ApiError } from "../api/client";

export function CategoryForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3fb950");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.SubmitEvent) {
    event.preventDefault();

    setError(null);
    setSaving(true);

    try {
      await api.createCategory({ name, color });
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
        placeholder="Ex: Saúde"
      />
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
      />
      <button disabled={saving}>
        {saving ? "Salvando..." : "Criar Categoria"}
      </button>

      {error && <p role="alert">{error}</p>}
    </form>
  );
}
