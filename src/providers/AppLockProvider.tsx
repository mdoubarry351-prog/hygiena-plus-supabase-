import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from "react";
import { AppState, AppStateStatus } from "react-native";
import { appLock } from "@/lib/app-lock";

type AppLockState = {
  enabled: boolean;
  biometric: boolean;
  locked: boolean;
  ready: boolean;
  unlock: () => void;
  refresh: () => Promise<void>;
};

const AppLockContext = createContext<AppLockState | undefined>(undefined);

export function AppLockProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [biometric, setBiometric] = useState(false);
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);

  const enabledRef = useRef(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const refresh = useCallback(async () => {
    const cfg = await appLock.getConfig();
    setEnabled(cfg.enabled);
    setBiometric(cfg.biometric);
    enabledRef.current = cfg.enabled;
    setReady(true);
  }, []);

  // Chargement initial : si le verrouillage est actif, on démarre verrouillé.
  useEffect(() => {
    (async () => {
      const cfg = await appLock.getConfig();
      setEnabled(cfg.enabled);
      setBiometric(cfg.biometric);
      enabledRef.current = cfg.enabled;
      if (cfg.enabled) setLocked(true);
      setReady(true);
    })();
  }, []);

  // Re-verrouille au retour d'arrière-plan.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const prev = appState.current;
      if (next === "active" && (prev === "background" || prev === "inactive")) {
        if (enabledRef.current) setLocked(true);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  const unlock = useCallback(() => setLocked(false), []);

  return (
    <AppLockContext.Provider value={{ enabled, biometric, locked, ready, unlock, refresh }}>
      {children}
    </AppLockContext.Provider>
  );
}

export function useAppLock(): AppLockState {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error("useAppLock doit être utilisé dans AppLockProvider");
  return ctx;
}
