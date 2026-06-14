import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { ToastBanner, type ToastType } from "@/components/Toast";

type ToastItem = { id: number; type: ToastType; message: string };

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<((type: ToastType, message: string) => void) | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  // File simple : on affiche un toast à la fois, puis le suivant.
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const show = useCallback((type: ToastType, message: string) => {
    idRef.current += 1;
    setQueue((q) => [...q, { id: idRef.current, type, message }]);
  }, []);

  const handleHide = useCallback(() => setQueue((q) => q.slice(1)), []);

  const current = queue[0];

  return (
    <ToastContext.Provider value={show}>
      {children}
      {current ? (
        <ToastBanner key={current.id} type={current.type} message={current.message} onHide={handleHide} />
      ) : null}
    </ToastContext.Provider>
  );
}

// Hook : toast.success/error/info. No-op si le provider n'est pas monté.
export function useToast(): ToastApi {
  const show = useContext(ToastContext);
  return useMemo<ToastApi>(
    () => ({
      success: (m) => show?.("success", m),
      error: (m) => show?.("error", m),
      info: (m) => show?.("info", m),
    }),
    [show]
  );
}
