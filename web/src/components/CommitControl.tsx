import { useId, useRef, useState } from "react";
import { api, ApiError, type CommitResponse } from "../api/client";
import { humanDate, today } from "../lib/date";
import { DatePicker } from "./DatePicker";

export function CommitControl({
  habitId,
  doneToday,
  onCommit,
  onError,
}: {
  habitId: number;
  doneToday: boolean;
  onCommit: (response: CommitResponse) => void;
  onError: (message: string) => void;
}) {
  const popoverId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [date, setDate] = useState(today());
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const startOfYear = `${today().slice(0, 4)}-01-01`;
  const backdated = date !== today();

  function place() {
    const anchor = toggleRef.current?.getBoundingClientRect();
    const popover = popoverRef.current;
    if (!anchor || !popover) return;

    const margin = 8;
    const width = popover.offsetWidth || 272;
    const height = popover.offsetHeight || 340;

    const left = Math.min(
      Math.max(margin, anchor.right - width),
      window.innerWidth - width - margin,
    );

    const below = anchor.bottom + 6;
    const above = anchor.top - height - 6;
    const fitsBelow = below + height <= window.innerHeight - margin;

    const top = fitsBelow
      ? below
      : Math.max(margin, above >= margin ? above : window.innerHeight - height - margin);

    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
    popover.style.bottom = "auto";
    popover.style.right = "auto";
  }

  async function send() {
    setSending(true);

    try {
      const payload = {
        ...(backdated ? { date } : {}),
        ...(message.trim() ? { message: message.trim() } : {}),
      };

      onCommit(await api.commit(habitId, payload));
      setMessage("");
      setDate(today());
      popoverRef.current?.hidePopover();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Falha de conexão");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="commit-control">
      <button
        type="button"
        className="commit-button"
        data-secondary={doneToday && !backdated ? "" : undefined}
        onClick={send}
        disabled={sending}
        title={backdated ? `Commit em ${humanDate(date)}` : "Commit hoje"}
      >
        {sending ? "…" : "✓ commit"}
      </button>

      <button
        ref={toggleRef}
        type="button"
        className="commit-toggle"
        data-active={backdated || message ? "" : undefined}
        popoverTarget={popoverId}
        aria-label="Escolher data e mensagem"
        onClick={place}
      >
        ⌄
      </button>

      <div
        ref={popoverRef}
        id={popoverId}
        popover="auto"
        className="commit-popover"
        onToggle={(event) => {
          if ((event as unknown as { newState: string }).newState === "open") {
            place();
          }
        }}
      >
        <p className="commit-popover-title">
          Commit em <strong>{humanDate(date)}</strong>
        </p>

        <DatePicker
          value={date}
          min={startOfYear}
          max={today()}
          onChange={setDate}
        />

        <label htmlFor={`commit-message-${habitId}`}>Mensagem</label>
        <input
          id={`commit-message-${habitId}`}
          value={message}
          maxLength={200}
          placeholder="opcional"
          onChange={(e) => setMessage(e.target.value)}
        />

        <button
          type="button"
          className="commit-confirm"
          onClick={send}
          disabled={sending}
        >
          {sending ? "Enviando…" : "Commitar"}
        </button>
      </div>
    </div>
  );
}
