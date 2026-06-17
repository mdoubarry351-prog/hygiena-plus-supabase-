import { supabase } from "@/lib/supabase";

// Salle d'appel renvoyée par l'Edge Function `consultation-room` (salle privée
// Daily + jeton temporaire). Seul un participant du RDV obtient un jeton.
export type ConsultationRoom = { roomUrl: string; token: string; isOwner: boolean };

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
