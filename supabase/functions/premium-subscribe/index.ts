// =====================================================
// Hygiena+ — Edge Function : premium-subscribe
//
// SEUL chemin de confiance pour activer / désactiver l'abonnement Premium.
// La cliente ne peut plus écrire profiles.is_premium ni subscription_payments
// directement (bloqué par RLS + triggers, cf. migration P0-1). Cette fonction
// s'exécute avec le service_role et applique le changement APRÈS vérification.
//
// ⚠️ ÉTAT ACTUEL : paiement SIMULÉ (aucun débit réel), conforme à l'UI
// « paiement simulé » de l'app. La frontière de sécurité est réelle (le client
// ne peut pas s'auto-accorder Premium), mais la vérification du paiement n'est
// pas encore branchée sur un fournisseur.
//
// 👉 PASSAGE EN PRODUCTION (décision produit requise — Orange Money / MTN) :
//    remplacer le bloc « PAIEMENT SIMULÉ » par la vérification cryptographique
//    du webhook du fournisseur (signature HMAC + montant + référence) avant
//    d'accorder Premium et d'enregistrer le paiement.
// =====================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, preflight } from "../_shared/http.ts";

function addDaysISO(days: number): { start: string; end: string } {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + days);
  const d = (x: Date) => x.toISOString().slice(0, 10); // YYYY-MM-DD
  return { start: d(now), end: d(end) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

  // 1) Identifier l'appelant à partir de son JWT (jamais depuis le body).
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Non authentifié" }, 401);
  }
  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Non authentifié" }, 401);
  const userId = userData.user.id;

  // 2) Client de confiance (service_role) pour appliquer le changement.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  let action = "subscribe";
  try {
    const body = await req.json();
    if (body?.action === "unsubscribe") action = "unsubscribe";
  } catch {
    // body optionnel -> subscribe par défaut
  }

  // 3) Vérifier que le Premium est activé côté serveur (app_settings).
  const { data: settings } = await admin
    .from("app_settings")
    .select("premium_enabled, premium_price, premium_duration_days")
    .limit(1)
    .maybeSingle();

  if (action === "unsubscribe") {
    const { error } = await admin
      .from("profiles")
      .update({ is_premium: false })
      .eq("id", userId);
    if (error) return json({ error: "Désabonnement échoué" }, 500);
    return json({ success: true, is_premium: false });
  }

  if (settings && settings.premium_enabled === false) {
    return json({ error: "Abonnement Premium indisponible" }, 403);
  }

  const amount = Number(settings?.premium_price ?? 50000);
  const durationDays = Number(settings?.premium_duration_days ?? 30);

  // 4) ---- PAIEMENT SIMULÉ ----------------------------------------------
  //    À REMPLACER par la vérification du webhook du fournisseur en prod.
  //    (Vérifier ici : signature, statut « succeeded », montant == amount,
  //     référence unique non rejouée.)
  // ----------------------------------------------------------------------

  // 5) Accorder Premium + consigner le paiement (append-only) — service_role.
  const { error: upErr } = await admin
    .from("profiles")
    .update({ is_premium: true })
    .eq("id", userId);
  if (upErr) return json({ error: "Activation échouée" }, 500);

  const { start, end } = addDaysISO(durationDays);
  await admin.from("subscription_payments").insert({
    user_id: userId,
    amount,
    method: "Mobile Money (simulé)",
    plan: "Premium",
    period_start: start,
    period_end: end,
    paid_at: new Date().toISOString(),
  });

  return json({ success: true, is_premium: true });
});
