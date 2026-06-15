import { Redirect, Stack, useSegments } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";
import { Loading } from "@/components/Loading";

export default function AuthLayout() {
  const { session, initializing } = useAuth();
  const segments = useSegments();
  // L'écran de réinitialisation doit rester accessible MÊME avec une session de
  // récupération active (sinon le garde ci-dessous renverrait vers l'accueil).
  const onReset = segments[segments.length - 1] === "reset-password";

  if (initializing) return <Loading />;
  // Déjà connecté : on renvoie vers l'aiguilleur racine (sauf flux de récupération).
  if (session && !onReset) return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false, animation: "slide_from_right", animationDuration: 200 }} />;
}
