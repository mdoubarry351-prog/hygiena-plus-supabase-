// Téléphone Guinée 🇬🇳 (+224). L'AFFICHAGE/saisie se fait au format local à
// tirets « XXX-XX-XX-XX » (9 chiffres), la valeur STOCKÉE/ENVOYÉE est E.164
// « +224XXXXXXXXX » (sans tirets/espaces) — compatible OTP, profiles.phone,
// commandes Marketplace et liens wa.me / tel:.

export const GUINEA_DIAL_CODE = "224";
export const GUINEA_DIAL = "+224";
export const GUINEA_FLAG = "🇬🇳";
export const PHONE_LOCAL_LENGTH = 9; // nombre de chiffres locaux (mobile Guinée)

// Garde uniquement les chiffres d'une chaîne.
export function onlyDigits(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

// Tronque à PHONE_LOCAL_LENGTH chiffres locaux.
export function clampLocal(input: string | null | undefined): string {
  return onlyDigits(input).slice(0, PHONE_LOCAL_LENGTH);
}

// Formate des chiffres locaux en « XXX-XX-XX-XX » (groupes 3-2-2-2), au fil de
// la saisie (tronqué à 9 chiffres). Renvoie "" si vide.
export function formatGuineaLocal(input: string | null | undefined): string {
  const d = clampLocal(input);
  if (!d) return "";
  const groups = [d.slice(0, 3), d.slice(3, 5), d.slice(5, 7), d.slice(7, 9)];
  return groups.filter(Boolean).join("-");
}

// Construit l'E.164 « +224XXXXXXXXX » à partir de chiffres locaux. Renvoie ""
// si aucun chiffre (pour gérer le cas « champ vide » côté appelant).
export function toE164(local: string | null | undefined): string {
  const d = clampLocal(local);
  return d ? `+${GUINEA_DIAL_CODE}${d}` : "";
}

// Depuis un numéro déjà stocké (E.164 avec/sans +224, espaces ou tirets) →
// chiffres locaux (9 max) pour réafficher dans le champ.
export function parseToLocalDigits(stored: string | null | undefined): string {
  let d = onlyDigits(stored);
  if (d.startsWith(GUINEA_DIAL_CODE) && d.length > PHONE_LOCAL_LENGTH) {
    d = d.slice(GUINEA_DIAL_CODE.length);
  }
  return d.slice(-PHONE_LOCAL_LENGTH);
}

// Pratique : numéro stocké → valeur d'affichage formatée (tirets).
export function formatStoredPhone(stored: string | null | undefined): string {
  return formatGuineaLocal(parseToLocalDigits(stored));
}

// Validation : exactement PHONE_LOCAL_LENGTH chiffres locaux.
export function isValidGuineaLocal(input: string | null | undefined): boolean {
  return clampLocal(input).length === PHONE_LOCAL_LENGTH;
}
