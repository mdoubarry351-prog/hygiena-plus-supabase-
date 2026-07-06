// =====================================================
// Helpers HTTP partagés des Edge Functions (P2 : CORS + en-têtes de sécurité).
//
// CORS : l'origine autorisée vient du secret ALLOWED_ORIGIN (ex.
// https://app.hygiena.plus). En son absence on retombe sur "*" pour ne pas
// casser le dev — À CONFIGURER EN PRODUCTION (dashboard → Functions → Secrets).
// Les apps natives (Android/iOS) n'envoient pas d'Origin → non affectées.
// =====================================================

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

// En-têtes de sécurité appliqués à TOUTES les réponses JSON :
// - nosniff : le navigateur ne « devine » pas un autre type de contenu ;
// - no-store : jamais de mise en cache (réponses d'auth/paiement) ;
// - frame/referrer : défense en profondeur pour des réponses d'API.
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};

export function json(body: unknown, status = 200, cors = true): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...(cors ? corsHeaders() : {}),
      ...SECURITY_HEADERS,
      "Content-Type": "application/json",
    },
  });
}

export function preflight(): Response {
  return new Response("ok", { headers: { ...corsHeaders(), ...SECURITY_HEADERS } });
}
