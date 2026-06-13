import { supabase } from "@/lib/supabase";
import type { Pregnancy } from "@/lib/database.types";

const GESTATION_DAYS = 280; // 40 semaines depuis les dernières règles (LMP)

// --------- Helpers de date (en UTC pour éviter les décalages de fuseau) ---------
function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function parseUTC(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

// Nombre de jours entiers entre deux dates ISO (toISO - fromISO).
function daysBetween(fromISO: string, toISO: string): number {
  return Math.floor((parseUTC(toISO) - parseUTC(fromISO)) / 86_400_000);
}

// --------- Calculs exposés à l'écran ---------

// Date prévue d'accouchement = dernières règles + 280 jours.
export function computeDueDate(startDate: string): string {
  const d = new Date(`${startDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + GESTATION_DAYS);
  return d.toISOString().split("T")[0];
}

// Semaine courante = floor((aujourd'hui - LMP) / 7), bornée à 1..40.
export function pregnancyWeek(startDate: string, today: string = todayISO()): number {
  const days = daysBetween(startDate, today);
  return Math.max(1, Math.min(40, Math.floor(days / 7)));
}

// Trimestre : 1 (s1-13), 2 (s14-27), 3 (s28-40).
export function trimester(week: number): 1 | 2 | 3 {
  if (week <= 13) return 1;
  if (week <= 27) return 2;
  return 3;
}

// Jours restants jusqu'à la date prévue (jamais négatif).
export function daysRemaining(dueDate: string, today: string = todayISO()): number {
  return Math.max(0, daysBetween(today, dueDate));
}

// Progression de 0 à 1 (part des 280 jours écoulée).
export function pregnancyProgress(startDate: string, today: string = todayISO()): number {
  const days = daysBetween(startDate, today);
  return Math.max(0, Math.min(1, days / GESTATION_DAYS));
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export const pregnancyService = {
  // Grossesse active de l'utilisatrice (une seule possible), ou null.
  async getActivePregnancy(): Promise<Pregnancy | null> {
    const me = await currentUserId();
    if (!me) return null;
    const { data, error } = await supabase
      .from("pregnancies")
      .select("*")
      .eq("user_id", me)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  },

  // Démarre un suivi : calcule la date prévue (+280 j) et insère is_active=true.
  async startPregnancy(startDate: string): Promise<Pregnancy> {
    const me = await currentUserId();
    if (!me) throw new Error("Vous devez être connectée.");
    const { data, error } = await supabase
      .from("pregnancies")
      .insert({ user_id: me, start_date: startDate, due_date: computeDueDate(startDate), is_active: true })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  // Termine le suivi (is_active=false).
  async endPregnancy(id: string): Promise<void> {
    const { error } = await supabase
      .from("pregnancies")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },
};
