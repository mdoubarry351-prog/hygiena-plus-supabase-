import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";
import { Loading } from "@/components/Loading";

export default function AuthLayout() {
  const { session, initializing } = useAuth();

  if (initializing) return <Loading />;
  // Déjà connecté : on renvoie vers l'aiguilleur racine.
  if (session) return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false, animation: "slide_from_right", animationDuration: 200 }} />;
}
