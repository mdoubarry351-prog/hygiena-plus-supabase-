import { supabase } from "@/lib/supabase";

// Salle d'appel renvoyée par l'Edge Function `consultation-room` (salle privée
// Daily + jeton temporaire). Seul un participant du RDV obtient un jeton.
export type ConsultationRoom = { roomUrl: string; token: string; isOwner: boolean };

// Anti-SSRF / anti-open-redirect (P0-6) : on ne rejoint JAMAIS une URL de salle
// arbitraire. Seules les URL https du domaine daily.co sont acceptées. Défense
// en profondeur côté client ; la même whitelist DOIT exister côté Edge Function
// consultation-room (voir supabase/SCHEMA_PULL_TODO.md).
export function isAllowedDailyRoomUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    return u.hostname === "daily.co" || u.hostname.endsWith(".daily.co");
  } catch {
    return false;
  }
}

// Fenêtre d'accès à la salle (chat ET appels) autour de l'heure du RDV :
// de 1 h avant à 1 h après. Unifiée pour le chat et les appels.
const CALL_WINDOW_BEFORE_MS = 60 * 60 * 1000;
const CALL_WINDOW_AFTER_MS = 60 * 60 * 1000;

// Parse une date/heure locale de RDV en timestamp (ms). Accepte « YYYY-MM-DD »
// + « HH:MM(:SS) », ou une chaîne ISO « YYYY-MM-DDTHH:MM:SS ». null si invalide.
export function appointmentAtMs(dateISO: string | null | undefined, time?: string | null): number | null {
  if (!dateISO) return null;
  const t = (time ?? "").slice(0, 5);
  const str = dateISO.includes("T") ? dateISO : `${dateISO}T${t || "00:00"}:00`;
  const ms = new Date(str).getTime();
  return Number.isNaN(ms) ? null : ms;
}

// La salle est-elle accessible maintenant (dans la fenêtre [RDV−1h, RDV+1h]) ?
export function isWithinCallWindow(atMs: number | null, nowMs: number): boolean {
  if (atMs == null) return false;
  return nowMs >= atMs - CALL_WINDOW_BEFORE_MS && nowMs <= atMs + CALL_WINDOW_AFTER_MS;
}

// État de la fenêtre d'accès d'un RDV par rapport à maintenant :
// - "active"   : maintenant ∈ [RDV−1h, RDV+1h] → salle déverrouillée
// - "upcoming" : RDV à venir mais > 1h avant → s'ouvrira plus tard
// - "closed"   : fenêtre passée (> 1h après le RDV)
// - "none"     : aucun horaire de RDV connu
export type RoomWindowState = "active" | "upcoming" | "closed" | "none";
export function roomWindowState(atMs: number | null, nowMs: number): RoomWindowState {
  if (atMs == null) return "none";
  if (nowMs < atMs - CALL_WINDOW_BEFORE_MS) return "upcoming";
  if (nowMs > atMs + CALL_WINDOW_AFTER_MS) return "closed";
  return "active";
}

// Récupère la salle pour un rendez-vous donné (JWT user via supabase.functions).
export async function getConsultationRoom(appointmentId: string): Promise<ConsultationRoom> {
  const { data, error } = await supabase.functions.invoke("consultation-room", { body: { appointmentId } });
  if (error) {
    let message = error.message || "Impossible de rejoindre la salle d'appel.";
    try {
      const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context;
      const body = ctx?.json ? ((await ctx.json()) as { error?: string }) : null;
      if (body?.error) message = body.error;
    } catch {
      // garde le message par défaut
    }
    throw new Error(message);
  }
  const body = data as (Partial<ConsultationRoom> & { error?: string }) | null;
  if (!body || body.error || !body.roomUrl || !body.token) {
    throw new Error(body?.error || "Salle d'appel indisponible.");
  }
  // Anti-SSRF : refuse toute URL de salle hors domaine daily.co.
  if (!isAllowedDailyRoomUrl(body.roomUrl)) {
    throw new Error("Salle d'appel invalide.");
  }
  return { roomUrl: body.roomUrl, token: body.token, isOwner: !!body.isOwner };
}
