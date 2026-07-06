import type { Href } from "expo-router";
import type { UserRole } from "@/lib/database.types";

/**
 * Renvoie la route racine du groupe correspondant au rôle.
 * Le médecin atterrit dans l'espace utilisateur `(user)` : il réutilise tous
 * les écrans patients, et accède à ses outils pro `(doctor)` via l'entrée
 * « Espace pro » du Profil. Seul l'admin a un espace dédié distinct.
 */
export function homeRouteForRole(role: UserRole): Href {
  switch (role) {
    case "admin":
      return "/admin";
    case "doctor":
    case "user":
    default:
      return "/(user)";
  }
}
