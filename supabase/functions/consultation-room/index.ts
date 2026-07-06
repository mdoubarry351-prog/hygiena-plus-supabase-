// =====================================================
// Hygiena+ — Edge Function : consultation-room
// (source importée de la version live v1, P0-6 ; CORS durci via _shared, P2)
//
// Crée/rejoint la salle vidéo Daily d'un rendez-vous. Garanties anti-SSRF :
//  - le nom de salle est DÉRIVÉ de l'appointmentId (jamais du body libre),
//    après vérification que l'appelant est bien participant du RDV ;
//  - les seuls appels sortants ciblent https://api.daily.co (constante) ;
//  - la roomUrl renvoyée est construite sur le domaine fixe DAILY_DOMAIN
//    (le client re-vérifie par whitelist *.daily.co, cf. src/lib/call-service.ts).
// =====================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { json, preflight } from "../_shared/http.ts";

const DAILY_DOMAIN = "hygienaplus.daily.co";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Non authentifié." }, 401);

  const dailyKey = Deno.env.get("DAILY_API_KEY");
  if (!dailyKey) return json({ error: "Service d'appel non configuré." }, 500);

  let appointmentId: string | undefined;
  try {
    const body = await req.json();
    appointmentId = body?.appointmentId;
  } catch (_) { /* ignore */ }
  if (!appointmentId) return json({ error: "appointmentId requis." }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user;
  if (!user) return json({ error: "Non authentifié." }, 401);

  const service = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: appt } = await service
    .from("appointments")
    .select("id, patient_id, doctor_id, appointment_date, appointment_time, status, is_paid")
    .eq("id", appointmentId)
    .single();
  if (!appt) return json({ error: "Rendez-vous introuvable." }, 404);

  const { data: doc } = await service
    .from("doctors").select("user_id").eq("id", appt.doctor_id).single();

  const isPatient = user.id === appt.patient_id;
  const isDoctor = !!doc && user.id === doc.user_id;
  if (!isPatient && !isDoctor) return json({ error: "Accès refusé." }, 403);

  const roomName = `appt-${appt.id}`;
  const nowSec = Math.floor(Date.now() / 1000);
  const roomExp = nowSec + 24 * 3600;
  const tokenExp = nowSec + 4 * 3600;

  // Créer la salle (idempotent : on ignore l'erreur si elle existe déjà)
  await fetch("https://api.daily.co/v1/rooms", {
    method: "POST",
    headers: { Authorization: `Bearer ${dailyKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: roomName,
      privacy: "private",
      properties: { exp: roomExp, eject_at_room_exp: true, enable_chat: false, enable_screenshare: false },
    }),
  });

  // Jeton d'accès court, propre au participant
  const tokenRes = await fetch("https://api.daily.co/v1/meeting-tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${dailyKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        is_owner: isDoctor,
        user_name: isDoctor ? "Praticien" : "Patiente",
        exp: tokenExp,
      },
    }),
  });
  if (!tokenRes.ok) {
    return json({ error: "Impossible de créer la session d'appel." }, 502);
  }
  const tokenData = await tokenRes.json();

  return json({
    roomUrl: `https://${DAILY_DOMAIN}/${roomName}`,
    token: tokenData.token,
    isOwner: isDoctor,
  });
});
