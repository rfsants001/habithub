import type { Toast } from "../lib/useToasts";

export function ToastHost({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <output key={toast.id} className="toast">
          {toast.text}
        </output>
      ))}
    </div>
  );
}
