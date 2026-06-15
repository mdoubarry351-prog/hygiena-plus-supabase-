import { useEffect } from "react";
import { Slot, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
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
import { setupNotificationHandler, getPermissionStatus, requestPermission, registerPushToken } from "@/lib/local-notifications";
import { notificationRouteFromTapData } from "@/lib/notification-routing";
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

// Notifications : configure le handler au démarrage, route les taps (push ET
// locales) vers le bon écran, enregistre le jeton push de l'utilisateur connecté,
// puis (pour une utilisatrice ayant fini l'onboarding) demande la permission une
// seule fois — APRÈS login, jamais au tout premier écran — et planifie les
// rappels cycle + RDV. Best-effort, silencieux, ne rend rien.
const NOTIF_PROMPT_FLAG = "notif_perm_prompted";
function NotificationsBootstrap() {
  const { session, role, profile } = useAuth();
  const uid = session?.user?.id ?? null;

  // Handler d'affichage au premier plan (une fois).
  useEffect(() => { setupNotificationHandler(); }, []);

  // Réponse au tap (push ou locale) → navigation. + cas du démarrage à froid.
  useEffect(() => {
    let sub: ReturnType<typeof Notifications.addNotificationResponseReceivedListener> | undefined;
    try {
      sub = Notifications.addNotificationResponseReceivedListener((response) => {
        try {
          const route = notificationRouteFromTapData(response?.notification?.request?.content?.data);
          if (route) router.push(route);
        } catch { /* no-op */ }
      });
    } catch { /* expo-notifications indisponible */ }

    (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        const route = last ? notificationRouteFromTapData(last.notification?.request?.content?.data) : null;
        if (route) router.push(route);
      } catch { /* no-op */ }
    })();

    return () => { try { sub?.remove(); } catch { /* no-op */ } };
  }, []);

  // Jeton push pour TOUT utilisateur connecté (self-guard permission + projectId
  // EAS ; upsert idempotent). No-op si permission non accordée / EAS absent.
  useEffect(() => {
    if (!uid) return;
    registerPushToken(uid);
  }, [uid]);

  // Utilisatrice : prompt doux (une fois) + rappels locaux ; re-tente le jeton
  // push juste après l'octroi éventuel de la permission.
  useEffect(() => {
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
        if (alive) {
          await resyncAllReminders(uid);
          await registerPushToken(uid);
        }
      } catch {
        // best-effort
      }
    })();
    return () => { alive = false; };
  }, [uid, role, profile?.onboarding_completed]);

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
