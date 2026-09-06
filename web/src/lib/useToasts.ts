import { useCallback, useRef, useState } from "react";

export type Toast = { id: number; text: string };

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const notify = useCallback((text: string) => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, text }]);
    setTimeout(
      () => setToasts((current) => current.filter((t) => t.id !== id)),
      3200,
    );
  }, []);

  return { toasts, notify };
}
