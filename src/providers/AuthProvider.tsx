import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { authService } from "@/lib/auth-service";
import { legalService, PENDING_CONSENT_KEY } from "@/lib/legal-service";
import { unregisterPushToken } from "@/lib/local-notifications";
import type { Profile, UserRole } from "@/lib/database.types";

// Enregistre le consentement en attente (posé à l'inscription) une fois la
// session active. Best-effort : ne bloque jamais le flux d'auth.
async function flushPendingConsent(userId: string) {
  try {
    const pending = await AsyncStorage.getItem(PENDING_CONSENT_KEY);
    if (!pending) return;
    await legalService.recordConsent(userId, pending);
    await AsyncStorage.removeItem(PENDING_CONSENT_KEY);
  } catch {
    // on réessaiera à la prochaine session ; le drapeau reste posé.
  }
}

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  role: UserRole | null;
  initializing: boolean; // true tant que la session initiale n'est pas résolue
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, names: { firstName: string; lastName: string; phone?: string }) => Promise<{ needsEmailConfirmation: boolean }>;
  signInWithPhone: (phone: string) => Promise<void>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initializing, setInitializing] = useState(true);
  const currentUserId = useRef<string | null>(null);

  async function loadProfile(userId: string) {
    const p = await authService.getProfile(userId);
    setProfile(p);
  }

  useEffect(() => {
    let mounted = true;

    // Session initiale
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      currentUserId.current = data.session?.user.id ?? null;
      if (data.session?.user) {
        await loadProfile(data.session.user.id);
        flushPendingConsent(data.session.user.id);
      }
      setInitializing(false);
    });

    // Écoute des changements d'auth (login, logout, refresh token)
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      const newUserId = newSession?.user.id ?? null;

      if (newUserId && newUserId !== currentUserId.current) {
        currentUserId.current = newUserId;
        await loadProfile(newUserId);
        flushPendingConsent(newUserId);
      } else if (!newUserId) {
        currentUserId.current = null;
        setProfile(null);
      }
    });

    // Refresh auto uniquement quand l'app est au premier plan
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      appStateSub.remove();
    };
  }, []);

  const value: AuthState = {
    session,
    profile,
    role: profile?.role ?? null,
    initializing,
    signIn: authService.signIn,
    signUp: authService.signUp,
    signInWithPhone: authService.signInWithPhone,
    verifyPhoneOtp: authService.verifyPhoneOtp,
    async signOut() {
      // Retire le jeton push AVANT de fermer la session (RLS : suppression
      // possible seulement tant qu'on est authentifié). Best-effort.
      const uid = session?.user?.id;
      if (uid) { try { await unregisterPushToken(uid); } catch { /* no-op */ } }
      await authService.signOut();
      setProfile(null);
      currentUserId.current = null;
    },
    async refreshProfile() {
      if (session?.user) await loadProfile(session.user.id);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
