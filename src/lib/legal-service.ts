import { supabase } from "@/lib/supabase";
import { LEGAL_VERSION } from "@/lib/legal";

// Drapeau local : version des textes acceptée à l'inscription, en attente
// d'enregistrement serveur dès qu'une session est active (cas confirmation
// e-mail où la session n'existe pas encore au moment du clic).
export const PENDING_CONSENT_KEY = "pending_consent_version";

// Enregistrement du consentement juridique (P0-3) : une ligne append-only par
// document (CGU + confidentialité) avec la version acceptée et la date.
export const legalService = {
  // Consigne le consentement de l'utilisatrice pour la version courante des
  // textes. Best-effort : ne doit jamais bloquer l'inscription/connexion.
  async recordConsent(userId: string, version: string = LEGAL_VERSION): Promise<void> {
    const rows = (["terms", "privacy"] as const).map((document) => ({
      user_id: userId,
      document,
      version,
    }));
    const { error } = await supabase.from("legal_consents").insert(rows);
    if (error) throw error;
  },

  // Vrai si l'utilisatrice a déjà consenti à la version indiquée (les deux docs).
  async hasConsented(userId: string, version: string = LEGAL_VERSION): Promise<boolean> {
    const { data, error } = await supabase
      .from("legal_consents")
      .select("document")
      .eq("user_id", userId)
      .eq("version", version);
    if (error) return false;
    const docs = new Set((data ?? []).map((r) => r.document));
    return docs.has("terms") && docs.has("privacy");
  },
};
