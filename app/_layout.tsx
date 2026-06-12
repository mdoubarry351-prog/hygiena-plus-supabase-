import { useEffect } from "react";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
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
import { LockScreen } from "@/components/LockScreen";

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
          <StatusBar style="dark" />
          <Slot />
          <AppLockGate />
        </AppLockProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
