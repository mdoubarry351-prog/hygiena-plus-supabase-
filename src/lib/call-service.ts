import { supabase } from "@/lib/supabase";

// Salle d'appel renvoyée par l'Edge Function `consultation-room` (salle privée
// Daily + jeton temporaire). Seul un participant du RDV obtient un jeton.
export type ConsultationRoom = { roomUrl: string; token: string; isOwner: boolean };

// Fenêtre d'appel autour de l'heure du RDV : de 5 min avant à 60 min après.
const CALL_WINDOW_BEFORE_MS = 5 * 60 * 1000;
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

// L'appel est-il accessible maintenant (dans la fenêtre du RDV) ?
export function isWithinCallWindow(atMs: number | null, nowMs: number): boolean {
  if (atMs == null) return false;
  return nowMs >= atMs - CALL_WINDOW_BEFORE_MS && nowMs <= atMs + CALL_WINDOW_AFTER_MS;
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
  return { roomUrl: body.roomUrl, token: body.token, isOwner: !!body.isOwner };
}
