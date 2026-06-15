import { useEffect } from "react";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { AppLockProvider, useAppLock } from "@/providers/AppLockProvider";
import { ToastProvider } from "@/providers/ToastProvider";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { LockScreen } from "@/components/LockScreen";
import { Onboarding } from "@/components/Onboarding";
import { setupNotificationHandler, getPermissionStatus, requestPermission } from "@/lib/local-notifications";
import { resyncAllReminders } from "@/lib/reminders";

// Garde l'écran de démarrage visible tant que les polices ne sont pas chargées.
SplashScreen.preventAutoHideAsync();

// Affiche l'écran de verrouillage PAR-DESSUS le contenu quand : l'utilisateur est
// connecté, le verrouillage est activé, et l'app est verrouillée. Ne bloque jamais
// l'écran de login (pas de session).
function AppLockGate() {
  const { session } = useAuth();
  const { enabled, locked } = useAppLock();
  if (session && enabled && locked) return <LockScreen />;
  return null;
}

// Notifications LOCALES : configure le handler au démarrage, puis (pour une
// utilisatrice connectée ayant fini l'onboarding) demande la permission une
// seule fois — APRÈS login, jamais au tout premier écran — et planifie les
// rappels cycle + RDV. Best-effort, silencieux, ne rend rien.
const NOTIF_PROMPT_FLAG = "notif_perm_prompted";
function NotificationsBootstrap() {
  const { session, role, profile } = useAuth();

  useEffect(() => { setupNotificationHandler(); }, []);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid || role !== "user" || !profile?.onboarding_completed) return;
    let alive = true;
    (async () => {
      try {
        const status = await getPermissionStatus();
        if (status === "undetermined") {
          const already = await AsyncStorage.getItem(NOTIF_PROMPT_FLAG);
          if (!already) {
            await AsyncStorage.setItem(NOTIF_PROMPT_FLAG, "1");
            await requestPermission(); // prompt doux, une seule fois
          }
        }
        if (alive) await resyncAllReminders(uid);
      } catch {
        // best-effort
      }
    })();
    return () => { alive = false; };
  }, [session?.user?.id, role, profile?.onboarding_completed]);

  return null;
}

// Onboarding première ouverture : seulement pour une utilisatrice ('user')
// connectée qui ne l'a pas encore terminé. Rôles doctor/admin : jamais.
function OnboardingGate() {
  const { session, profile, role } = useAuth();
  if (session && role === "user" && profile && !profile.onboarding_completed) return <Onboarding />;
  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    // On masque le splash dès que les polices sont prêtes (ou en cas d'erreur,
    // pour ne jamais rester bloqué : repli sur la police système).
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppLockProvider>
          <ToastProvider>
            <ConfirmProvider>
              <StatusBar style="dark" />
              <Slot />
            </ConfirmProvider>
          </ToastProvider>
          {/* Notifications locales : handler + planification des rappels. */}
          <NotificationsBootstrap />
          {/* Onboarding par-dessus l'app ; le verrou reste au-dessus de tout. */}
          <OnboardingGate />
          <AppLockGate />
        </AppLockProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
