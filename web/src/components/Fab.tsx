import { useEffect, useRef, useState } from "react";

export function Fab({
  onNewCategory,
  onNewHabit,
}: {
  onNewCategory: () => void;
  onNewHabit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function pick(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div className="fab" ref={ref}>
      {open && (
        <div className="fab-dial">
          <button type="button" onClick={() => pick(onNewCategory)}>
            Cadastrar categoria
          </button>
          <button type="button" onClick={() => pick(onNewHabit)}>
            Cadastrar hábito
          </button>
        </div>
      )}

      <button
        type="button"
        className="fab-button"
        aria-expanded={open}
        aria-label={open ? "Fechar menu" : "Cadastrar"}
        onClick={() => setOpen((value) => !value)}
      >
        +
      </button>
    </div>
  );
}
