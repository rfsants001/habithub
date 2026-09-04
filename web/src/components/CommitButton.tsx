import { useState } from "react";
import { api, ApiError, type CommitResponse } from "../api/client";

export function CommitButton({
  habitId,
  onCommit,
}: {
  habitId: number;
  onCommit: (response: CommitResponse) => void;
}) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function commit() {
    setSending(true);
    setError(null);

    try {
      onCommit(await api.commit(habitId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha de conexão");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button onClick={commit} disabled={sending}>
        {sending ? "…" : "✓ commit"}
      </button>

      {error && <span role="alert">{error}</span>}
    </>
  );
}
