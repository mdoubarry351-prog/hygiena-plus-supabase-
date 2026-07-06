// =====================================================
// Hygiena+ — Edge Function : payment-webhook
//
// Point d'entrée UNIQUE et de CONFIANCE pour confirmer un paiement réel
// (Orange Money / MTN Mobile Money) et, seulement alors, accorder Premium
// (profiles.is_premium) ou marquer une commande payée (marketplace_orders.
// is_paid). La cliente ne peut jamais écrire ces champs (RLS + triggers P0-1).
//
// Sécurité (OWASP — vérification cryptographique des webhooks) :
//   1) Vérifier la SIGNATURE HMAC du fournisseur (secret partagé) -> rejette
//      tout appel non authentique (403).
//   2) ANTI-REJEU : chaque référence de transaction est unique dans
//      public.payment_events -> un webduplicata déjà traité est ignoré.
//   3) Vérifier statut == succès ET montant attendu.
//   4) Muter is_premium / is_paid via service_role uniquement.
//
// ⚠️ SCAFFOLD : les blocs marqués « TODO PROVIDER » dépendent des contrats
// Orange Money / MTN (format d'en-tête de signature, schéma du payload,
// algorithme HMAC exact). À compléter à la signature des conventions
// fournisseur. Secrets attendus (Supabase → Function secrets) :
//   ORANGE_MOMO_WEBHOOK_SECRET, MTN_MOMO_WEBHOOK_SECRET
// =====================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac, timingSafeEqual } from "node:crypto";

type Provider = "orange_money" | "mtn_momo";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Comparaison à temps constant de la signature attendue vs reçue.
function verifyHmac(secret: string, rawBody: string, provided: string): boolean {
  if (!provided) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 1) Identifier le fournisseur (par en-tête ou route). TODO PROVIDER : ajuster.
  const provider = (req.headers.get("x-payment-provider") ?? "") as Provider;
  if (provider !== "orange_money" && provider !== "mtn_momo") {
    return json({ error: "Fournisseur inconnu" }, 400);
  }
  const secret =
    provider === "orange_money"
      ? Deno.env.get("ORANGE_MOMO_WEBHOOK_SECRET")
      : Deno.env.get("MTN_MOMO_WEBHOOK_SECRET");
  if (!secret) return json({ error: "Configuration paiement manquante" }, 500);

  // 2) Vérifier la signature HMAC sur le corps BRUT (avant tout parsing).
  const rawBody = await req.text();
  // TODO PROVIDER : nom réel de l'en-tête de signature (ex. « X-Signature »).
  const signature = req.headers.get("x-signature") ?? "";
  if (!verifyHmac(secret, rawBody, signature)) {
    return json({ error: "Signature invalide" }, 403);
  }

  // 3) Parser le payload vérifié. TODO PROVIDER : adapter au schéma réel.
  let evt: {
    reference?: string;
    status?: string;
    amount?: number;
    target_type?: "premium" | "order";
    target_id?: string;
  };
  try {
    evt = JSON.parse(rawBody);
  } catch {
    return json({ error: "Payload illisible" }, 400);
  }
  const { reference, status, amount, target_type, target_id } = evt;
  if (!reference || !status || amount == null || !target_type) {
    return json({ error: "Payload incomplet" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 4) ANTI-REJEU : insertion unique (provider, reference). Si déjà présent,
  //    on ignore (idempotent) — un webhook rejoué ne re-crédite jamais.
  const { error: insErr } = await admin.from("payment_events").insert({
    provider,
    reference,
    status,
    amount,
    target_type,
    target_id: target_id ?? null,
    raw: evt,
  });
  if (insErr) {
    // 23505 = violation d'unicité => déjà traité.
    if ((insErr as { code?: string }).code === "23505") {
      return json({ success: true, duplicate: true });
    }
    return json({ error: "Enregistrement impossible" }, 500);
  }

  // 5) N'agir que sur un paiement RÉUSSI. (Statut exact selon le fournisseur.)
  if (status !== "succeeded" && status !== "SUCCESSFUL") {
    return json({ success: true, applied: false });
  }

  // 6) Muter la ressource ciblée via service_role (seul chemin autorisé).
  if (target_type === "premium" && target_id) {
    // TODO PROVIDER : vérifier amount == prix Premium courant (app_settings).
    await admin.from("profiles").update({ is_premium: true }).eq("id", target_id);
    await admin.from("subscription_payments").insert({
      user_id: target_id,
      amount,
      method: provider === "orange_money" ? "Orange Money" : "MTN Mobile Money",
      plan: "Premium",
      paid_at: new Date().toISOString(),
    });
  } else if (target_type === "order" && target_id) {
    // TODO PROVIDER : vérifier amount == marketplace_orders.total_amount.
    await admin
      .from("marketplace_orders")
      .update({ is_paid: true, paid_at: new Date().toISOString() })
      .eq("id", target_id);
  }

  return json({ success: true, applied: true });
});
