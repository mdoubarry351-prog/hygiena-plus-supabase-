import { Stack } from "expo-router";

// Espace juridique PUBLIC : accessible AVANT l'inscription, sans RoleGuard ni
// session (exigence P0-3 — la confidentialité et les CGU doivent être lisibles
// avant de créer un compte).
export default function LegalLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: "slide_from_right", animationDuration: 200 }} />;
}
