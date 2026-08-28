import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export type ToastKind = "info" | "success" | "error";
interface ToastItem { id: number; message: string; kind: ToastKind }

interface ToastContextValue {
  show: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, kind: ToastKind = "info") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="toast-host">
        {toasts.map((t) => <div key={t.id} className={`toast toast-${t.kind}`}>{t.message}</div>)}
      </div>
    </ToastContext.Provider>
  );
}
