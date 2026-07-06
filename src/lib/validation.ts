// Validation simple d'une adresse email (format courant).
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

// Politique mot de passe (P0-5) : minimum requis 8, recommandé 12.
// ⚠️ Le minimum ET la protection « mots de passe compromis » (HaveIBeenPwned)
// doivent AUSSI être activés côté serveur dans Supabase → Auth → Passwords
// (Minimum password length = 8, Leaked password protection = ON). Le contrôle
// client ci-dessous n'est qu'une commodité UX : il ne remplace pas le serveur.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_RECOMMENDED_LENGTH = 12;

// Renvoie un message d'erreur si le mot de passe est trop court, sinon null.
export function passwordIssue(pw: string): string | null {
  if (pw.length < PASSWORD_MIN_LENGTH) return `Au moins ${PASSWORD_MIN_LENGTH} caractères.`;
  return null;
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
  if (pw.length < PASSWORD_MIN_LENGTH) return { score: 1, label: "Faible" };
  if (pw.length >= PASSWORD_RECOMMENDED_LENGTH && variety >= 3) return { score: 3, label: "Fort" };
  if (pw.length >= PASSWORD_MIN_LENGTH && variety >= 2) return { score: 2, label: "Moyen" };
  return { score: 1, label: "Faible" };
}
