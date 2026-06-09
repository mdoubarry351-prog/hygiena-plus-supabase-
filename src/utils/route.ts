import type { UserRole } from "@/lib/database.types";

/** Renvoie la route racine du groupe correspondant au rôle. */
export function homeRouteForRole(role: UserRole): string {
  switch (role) {
    case "admin":
      return "/(admin)";
    case "doctor":
      return "/(doctor)";
    case "user":
    default:
      return "/(user)";
  }
}
