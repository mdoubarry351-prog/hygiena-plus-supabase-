import { supabase } from "@/lib/supabase";
import type { MenstrualCycle, TablesInsert, TablesUpdate } from "@/lib/database.types";

export const SYMPTOMS = [
  "Crampes", "Maux de tête", "Ballonnements", "Fatigue", "Sautes d'humeur",
  "Sensibilité des seins", "Acné", "Pertes", "Fringales", "Nausées", "Douleurs lombaires",
  "Insomnie", "Anxiété", "Irritabilité", "Baisse de libido", "Hausse de libido",
] as const;

// Flux menstruel (sélection unique, désélectionnable).
export const FLOW_OPTIONS = ["Léger", "Moyen", "Abondant", "Très abondant"] as const;

// Humeur du jour (sélection unique, désélectionnable). Les anciennes valeurs déjà
// enregistrées (ex. « Bien », « Énergique ») restent valides à l'affichage.
export const MOOD_OPTIONS = ["Très heureuse", "Heureuse", "Neutre", "Triste", "Stressée", "Anxieuse", "En colère"] as const;

export type CyclePrediction = {
  averageCycleLength: number;
  averagePeriodLength: number;
  nextPeriodStart: Date | null;
  nextOvulation: Date | null;
  fertileWindowStart: Date | null;
  fertileWindowEnd: Date | null;
  currentDay: number | null;
  hasEnoughData: boolean;
};

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

export const cycleService = {
  async getCycles(userId: string): Promise<MenstrualCycle[]> {
    const { data, error } = await supabase
      .from("menstrual_cycles")
      .select("*")
      .eq("user_id", userId)
      .order("period_start", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async addCycle(entry: TablesInsert<"menstrual_cycles">): Promise<MenstrualCycle> {
    const { data, error } = await supabase
      .from("menstrual_cycles").insert(entry).select("*").single();
    if (error) throw error;
    return data;
  },

  // Récupère une saisie unique (mode édition).
  async getCycle(id: string): Promise<MenstrualCycle | null> {
    const { data, error } = await supabase
      .from("menstrual_cycles").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },

  // Met à jour une saisie existante (édition). user_id non modifié.
  async updateCycle(id: string, patch: TablesUpdate<"menstrual_cycles">): Promise<MenstrualCycle> {
    const { data, error } = await supabase
      .from("menstrual_cycles").update(patch).eq("id", id).select("*").single();
    if (error) throw error;
    return data;
  },

  async deleteCycle(id: string) {
    const { error } = await supabase.from("menstrual_cycles").delete().eq("id", id);
    if (error) throw error;
  },

  computePrediction(cycles: MenstrualCycle[]): CyclePrediction {
    const sorted = [...cycles].sort(
      (a, b) => new Date(a.period_start).getTime() - new Date(b.period_start).getTime()
    );
    const DEFAULT_CYCLE = 28;
    const DEFAULT_PERIOD = 5;

    // Écarts entre débuts consécutifs. Filtre élargi (5 à 90 j) pour tolérer
    // les saisies de test et les cycles irréguliers, en ignorant les doublons (0 j).
    const cycleLengths: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const len = daysBetween(new Date(sorted[i - 1].period_start), new Date(sorted[i].period_start));
      if (len >= 5 && len <= 90) cycleLengths.push(len);
    }

    const periodLengths: number[] = [];
    for (const c of sorted) {
      if (c.period_end) {
        const len = daysBetween(new Date(c.period_start), new Date(c.period_end)) + 1;
        if (len > 0 && len < 15) periodLengths.push(len);
      }
    }

    const avg = (arr: number[], fb: number) =>
      arr.length ? Math.round(arr.reduce((s, n) => s + n, 0) / arr.length) : fb;

    const averageCycleLength = avg(cycleLengths, DEFAULT_CYCLE);
    const averagePeriodLength = avg(periodLengths, DEFAULT_PERIOD);

    // Prédictions dès qu'on a au moins 1 cycle enregistré (avec valeurs par défaut
    // si pas assez d'historique pour calculer une vraie moyenne).
    const hasEnoughData = sorted.length >= 1;

    const last = sorted[sorted.length - 1];
    if (!last) {
      return {
        averageCycleLength, averagePeriodLength,
        nextPeriodStart: null, nextOvulation: null,
        fertileWindowStart: null, fertileWindowEnd: null,
        currentDay: null, hasEnoughData: false,
      };
    }

    const lastStart = new Date(last.period_start);
    const nextPeriodStart = addDays(lastStart, averageCycleLength);
    const nextOvulation = addDays(nextPeriodStart, -14);
    const fertileWindowStart = addDays(nextOvulation, -5);
    const fertileWindowEnd = addDays(nextOvulation, 1);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const currentDay = daysBetween(lastStart, today) + 1;

    return {
      averageCycleLength, averagePeriodLength,
      nextPeriodStart, nextOvulation, fertileWindowStart, fertileWindowEnd,
      currentDay: currentDay > 0 && currentDay <= averageCycleLength + 15 ? currentDay : null,
      hasEnoughData,
    };
  },
};

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = arr.reduce((s, n) => s + n, 0) / arr.length;
  const v = arr.reduce((s, n) => s + (n - m) ** 2, 0) / arr.length;
  return Math.sqrt(v);
}
function fmtDate(d: Date | null): string {
  return d ? d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : "—";
}
function fmtISODate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

/**
 * Construit un résumé TEXTE du suivi de cycle (pour partage en messagerie).
 * Réutilise la prédiction + agrège symptômes/flux/humeur. Renvoie null si pas
 * assez de cycles enregistrés (< 2).
 */
export function buildCycleSummary(cycles: MenstrualCycle[], prediction: CyclePrediction | null): string | null {
  if (cycles.length < 2) return null;
  const sorted = [...cycles].sort(
    (a, b) => new Date(a.period_start).getTime() - new Date(b.period_start).getTime()
  );

  // Régularité (écarts entre débuts consécutifs).
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const len = daysBetween(new Date(sorted[i - 1].period_start), new Date(sorted[i].period_start));
    if (len >= 5 && len <= 90) gaps.push(len);
  }
  const periodLengthsCount = sorted.filter((c) => !!c.period_end).length;

  // Symptômes / flux / humeur les plus fréquents.
  const count = (vals: (string | null | undefined)[]) => {
    const m = new Map<string, number>();
    for (const v of vals) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const symptomCounts = count(cycles.flatMap((c) => c.symptoms ?? []));
  const topSymptoms = symptomCounts.slice(0, 3).map((e) => e[0]);
  const topFlow = count(cycles.map((c) => c.flow))[0]?.[0] ?? null;
  const topMood = count(cycles.map((c) => c.mood))[0]?.[0] ?? null;

  const lines: string[] = ["📋 Mon suivi de cycle"];
  if (gaps.length >= 1) lines.push(`• Cycle moyen : ${prediction?.averageCycleLength ?? 28} j`);
  if (periodLengthsCount >= 1) lines.push(`• Règles : ${prediction?.averagePeriodLength ?? 5} j`);
  if (gaps.length >= 2) lines.push(`• Régularité : ${stddev(gaps) <= 3 ? "régulier" : "irrégulier"}`);
  lines.push(`• Dernières règles : ${fmtISODate(sorted[sorted.length - 1].period_start)}`);
  if (prediction?.nextPeriodStart) lines.push(`• Prochaines règles : ~ ${fmtDate(prediction.nextPeriodStart)}`);
  if (topSymptoms.length) lines.push(`• Symptômes fréquents : ${topSymptoms.join(", ").toLowerCase()}`);
  if (topFlow) lines.push(`• Flux habituel : ${topFlow}`);
  if (topMood) lines.push(`• Humeur fréquente : ${topMood}`);
  return lines.join("\n");
}
