import { Modal } from "./Modal";

export function ConfirmDialog({
  open,
  title,
  message,
  error,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  error?: string | null;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p>{message}</p>

      {error && <p role="alert">{error}</p>}

      <div className="modal-actions">
        <button type="button" onClick={onClose} disabled={busy}>
          Cancelar
        </button>
        <button
          type="button"
          className="danger"
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? "Excluindo…" : "Excluir"}
        </button>
      </div>
    </Modal>
  );
}
