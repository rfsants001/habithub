import { useState } from "react";
import { api, ApiError } from "../api/client";

export function CategoryForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [colorHue, setColorHue] = useState(120);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.SubmitEvent) {
    event.preventDefault();

    setError(null);
    setSaving(true);

    try {
      await api.createCategory({ name, colorHue });
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
        type="range"
        min={0}
        max={360}
        value={colorHue}
        onChange={(e) => setColorHue(Number(e.target.value))}
      />
      <span
        style={{
          background: `hsl(${colorHue}, 65%, 45%)`,
          width: 24,
          height: 24,
          display: "inline-block",
        }}
      />
      <button disabled={saving}>
        {saving ? "Salvando..." : "Criar Categoria"}
      </button>

      {error && <p role="alert">{error}</p>}
    </form>
  );
}
