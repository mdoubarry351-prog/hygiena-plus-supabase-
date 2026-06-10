import { ReactNode } from "react";
import { Redirect } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";
import { Loading } from "@/components/Loading";
import type { UserRole } from "@/lib/database.types";

/**
 * Protège un groupe de routes : exige une session active et un rôle autorisé.
 * - Pas de session -> redirige vers /(auth)/login
 * - Session mais profil non chargé -> écran de chargement
 * - Rôle non autorisé -> renvoie vers l'aiguilleur racine (qui redirige vers
 *   le bon espace selon le rôle réel)
 *
 * `allow` accepte un rôle unique ou une liste de rôles. Exemple : l'espace
 * utilisateur autorise `["user", "doctor"]` car le médecin réutilise tous les
 * écrans patients en plus de ses outils pro.
 */
export function RoleGuard({
  allow,
  children,
}: {
  allow: UserRole | UserRole[];
  children: ReactNode;
}) {
  const { session, profile, initializing } = useAuth();

  if (initializing) return <Loading />;
  if (!session) return <Redirect href="/(auth)/login" />;
  if (!profile) return <Loading />;

  const allowed = Array.isArray(allow) ? allow : [allow];
  if (!allowed.includes(profile.role)) return <Redirect href="/" />;

  return <>{children}</>;
}
