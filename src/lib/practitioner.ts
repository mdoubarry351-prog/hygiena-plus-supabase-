import type { PractitionerType, ConsultationMode } from "@/lib/database.types";

// Libellés/présentation par type de praticien. Centralisés ici pour adapter les
// écrans (hub, liste, fiche, réservation, reçu) sans dupliquer les chaînes ni
// créer de système parallèle. L'ajout d'une 3ᵉ spécialité = une entrée de plus.
export type PractitionerLabels = {
  type: PractitionerType;
  emoji: string;
  // Titre complet de la spécialité (hub, en-têtes).
  title: string;
  // Titre court (chips, badges).
  shortTitle: string;
  // Nom du praticien (minuscule / capitalisé).
  noun: string;
  nounCap: string;
  // Libellé « vérifié » (accord inclusif pour la thérapie).
  verifiedLabel: string;
  // CTA de réservation + titre d'en-tête de la fiche.
  bookCta: string;
  bookHeader: string;
  // Sous-titre du hub.
  hubSubtitle: string;
  // Libellés du mode de consultation selon le type (remote / physical).
  modeLabel: Record<ConsultationMode, string>;
};

const GYNECOLOGY: PractitionerLabels = {
  type: "gynecology",
  emoji: "👩‍⚕️",
  title: "Gynécologie",
  shortTitle: "Gynécologie",
  noun: "médecin",
  nounCap: "Médecin",
  verifiedLabel: "Médecin vérifié",
  bookCta: "Prendre rendez-vous",
  bookHeader: "Prendre rendez-vous",
  hubSubtitle: "Médecins vérifiées, consultation en clinique ou à distance",
  modeLabel: { remote: "À distance", physical: "En clinique" },
};

const THERAPY: PractitionerLabels = {
  type: "therapy",
  emoji: "🧠",
  title: "Thérapie & santé mentale",
  shortTitle: "Thérapie",
  noun: "thérapeute",
  nounCap: "Thérapeute",
  verifiedLabel: "Thérapeute vérifié·e",
  bookCta: "Réserver une séance",
  bookHeader: "Réserver une séance",
  hubSubtitle: "Thérapeutes vérifié·es, séance en ligne ou en présentiel",
  modeLabel: { remote: "En ligne", physical: "En présentiel" },
};

export const PRACTITIONER_LABELS: Record<PractitionerType, PractitionerLabels> = {
  gynecology: GYNECOLOGY,
  therapy: THERAPY,
};

// Toutes les spécialités du hub (ordre d'affichage). Extensible.
export const PRACTITIONER_TYPES: PractitionerType[] = ["gynecology", "therapy"];

// Normalise une valeur potentiellement nulle/inconnue → type sûr (défaut gynéco).
export function practitionerTypeOf(t: string | null | undefined): PractitionerType {
  return t === "therapy" ? "therapy" : "gynecology";
}

// Raccourci : libellés à partir d'une valeur brute (colonne practitioner_type).
export function practitionerLabels(t: string | null | undefined): PractitionerLabels {
  return PRACTITIONER_LABELS[practitionerTypeOf(t)];
}

// Libellé du mode de consultation adapté au type de praticien (reçu, historique).
export function consultationModeLabel(mode: ConsultationMode, t: string | null | undefined): string {
  return practitionerLabels(t).modeLabel[mode];
}
