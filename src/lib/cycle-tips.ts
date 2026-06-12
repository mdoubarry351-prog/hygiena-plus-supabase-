// Conseils du jour selon la phase du cycle — bien-être, doux, NON médical/prescriptif.

export type CyclePhase = "menstruelle" | "folliculaire" | "fertile" | "ovulation" | "luteale";

export const PHASE_LABEL: Record<CyclePhase, string> = {
  menstruelle: "Phase menstruelle",
  folliculaire: "Phase folliculaire",
  fertile: "Fenêtre fertile",
  ovulation: "Ovulation",
  luteale: "Phase lutéale",
};

export const CYCLE_TIPS: Record<CyclePhase, string[]> = {
  menstruelle: [
    "C'est le moment de ralentir : repose-toi et hydrate-toi bien.",
    "Une bouillotte ou une tisane chaude peuvent apaiser les tensions.",
    "Des aliments riches en fer (lentilles, épinards) aident à refaire le plein d'énergie.",
    "Écoute ton corps : une marche douce peut soulager les crampes.",
  ],
  folliculaire: [
    "Ton énergie remonte : profites-en pour bouger et démarrer de nouveaux projets.",
    "Une alimentation fraîche et colorée accompagne bien cette phase.",
    "Bonne période pour les activités créatives et les moments entre amies.",
  ],
  fertile: [
    "Ton énergie est élevée : idéal pour les activités qui te font du bien.",
    "Pense à bien t'hydrater et à privilégier des repas équilibrés.",
    "Reste à l'écoute de ton corps et de tes envies ces jours-ci.",
  ],
  ovulation: [
    "Tu es probablement au pic de ton énergie aujourd'hui : savoure-le.",
    "Un bon sommeil et une hydratation régulière soutiennent ton bien-être.",
    "Moment favorable pour les échanges et la confiance en soi.",
  ],
  luteale: [
    "Tu peux te sentir plus fatiguée : accorde-toi du repos et des aliments riches en magnésium (chocolat noir, oléagineux).",
    "Des envies de sucre ? Privilégie des collations douces comme les fruits ou les oléagineux.",
    "Sois douce avec toi-même : un peu de calme et de routine font du bien.",
    "Une activité apaisante (étirements, respiration) peut aider à relâcher les tensions.",
  ],
};

// Phase courante à partir du jour de cycle et des bornes déjà calculées (mêmes
// que l'anneau). Renvoie null si le jour est inconnu (pas assez de données).
export function currentPhase(params: {
  day: number | null | undefined;
  periodLen: number;
  fertileStartDay: number;
  fertileEndDay: number;
  ovulationDay: number;
}): CyclePhase | null {
  const { day, periodLen, fertileStartDay, fertileEndDay, ovulationDay } = params;
  if (day == null || day < 1) return null;
  if (day <= periodLen) return "menstruelle";
  if (day === ovulationDay) return "ovulation";
  if (day >= fertileStartDay && day <= fertileEndDay) return "fertile";
  if (day < fertileStartDay) return "folliculaire";
  return "luteale";
}

// Conseil DÉTERMINISTE pour la journée (stable sur la journée, change chaque jour).
export function getDailyTip(phase: CyclePhase, date = new Date()): string {
  const tips = CYCLE_TIPS[phase];
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000);
  return tips[dayOfYear % tips.length];
}
