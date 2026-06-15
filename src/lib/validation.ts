// Validation simple d'une adresse email (format courant).
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

// Force d'un mot de passe : score 0..3 (faible/moyen/fort) selon longueur + variété.
export type PasswordStrength = { score: 0 | 1 | 2 | 3; label: string };

export function passwordStrength(pw: string): PasswordStrength {
  if (!pw) return { score: 0, label: "" };
  let variety = 0;
  if (/[a-z]/.test(pw)) variety++;
  if (/[A-Z]/.test(pw)) variety++;
  if (/[0-9]/.test(pw)) variety++;
  if (/[^A-Za-z0-9]/.test(pw)) variety++;
  if (pw.length < 6) return { score: 1, label: "Faible" };
  if (pw.length >= 10 && variety >= 3) return { score: 3, label: "Fort" };
  if (pw.length >= 8 && variety >= 2) return { score: 2, label: "Moyen" };
  return { score: 1, label: "Faible" };
}
