import { supabase } from "./supabase";
import type { Profile, TablesUpdate } from "./database.types";

const SUSPENDED_MESSAGE = "Votre compte a été suspendu. Contactez l'administrateur.";

/**
 * Traduit l'erreur Supabase d'un compte banni en un message clair en français.
 * Supabase renvoie un code "user_banned" (et un message « User is banned »).
 * Toute autre erreur est renvoyée telle quelle.
 */
function mapAuthError(error: unknown): Error {
  const code = (error as { code?: string } | null)?.code;
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (code === "user_banned" || /banned/i.test(message)) {
    return new Error(SUSPENDED_MESSAGE);
  }
  return error instanceof Error ? error : new Error(message);
}

/**
 * Service d'authentification. Centralise tous les appels Supabase Auth
 * + la lecture/écriture du profil applicatif (table public.profiles).
 */
export const authService = {
  async signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw mapAuthError(error);
  },

  /**
   * Inscription. Le profil est créé côté DB par le trigger on_auth_user_created.
   * On complète ensuite prénom/nom + full_name (« Prénom Nom ») si la session
   * est active. full_name reste la source d'affichage partout dans l'app.
   */
  async signUp(email: string, password: string, names: { firstName: string; lastName: string; phone?: string }) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    // Si la confirmation email est désactivée, une session existe déjà :
    // on peut alors compléter le profil. Sinon, ce sera fait à la 1re connexion.
    if (data.session && data.user) {
      const fullName = `${names.firstName} ${names.lastName}`.trim();
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          first_name: names.firstName,
          last_name: names.lastName,
          full_name: fullName,
          email,
          phone: names.phone?.trim() ? names.phone.trim() : null,
        })
        .eq("id", data.user.id);
      if (profileError) {
        // Non bloquant : le profil de base existe déjà via le trigger.
        console.warn("Complétion du profil échouée:", profileError.message);
      }
    }

    return { needsEmailConfirmation: !data.session };
  },

  // --- Édition des infos personnelles (réutilisé user + médecin) ---

  /** Prénom + Nom → maj first_name/last_name ET full_name (« Prénom Nom »). */
  async updateNames(userId: string, firstName: string, lastName: string) {
    const fullName = `${firstName} ${lastName}`.trim();
    const { error } = await supabase
      .from("profiles")
      .update({ first_name: firstName, last_name: lastName, full_name: fullName })
      .eq("id", userId);
    if (error) throw error;
  },

  /** Numéro de téléphone. */
  async updatePhone(userId: string, phone: string | null) {
    const { error } = await supabase.from("profiles").update({ phone }).eq("id", userId);
    if (error) throw error;
  },

  /**
   * Adresse email via Supabase Auth (⚠️ un email de confirmation peut être
   * envoyé ; l'email réel ne change qu'après confirmation). On reflète aussi
   * la valeur dans profiles (best-effort, non bloquant).
   */
  async updateEmail(userId: string, email: string) {
    const { error } = await supabase.auth.updateUser({ email });
    if (error) throw error;
    const { error: profileError } = await supabase.from("profiles").update({ email }).eq("id", userId);
    if (profileError) console.warn("MAJ email profil:", profileError.message);
  },

  /** Mot de passe via Supabase Auth. */
  async updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * Suppression DÉFINITIVE de son propre compte (exigence App Store).
   * Invoque l'Edge Function `admin-user-actions` (action `delete_self`) qui
   * supprime le compte auth → cascade (profil + toutes les données). Puis
   * déconnecte la session : le provider d'auth renvoie alors vers la connexion.
   */
  async deleteOwnAccount() {
    const { data, error } = await supabase.functions.invoke("admin-user-actions", {
      body: { action: "delete_self" },
    });
    if (error) {
      let message = error.message || "Suppression du compte échouée";
      try {
        const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context;
        const body = ctx?.json ? ((await ctx.json()) as { error?: string }) : null;
        if (body?.error) message = body.error;
      } catch {
        // on garde le message par défaut
      }
      throw new Error(message);
    }
    const body = data as { success?: boolean; error?: string } | null;
    if (body?.error) throw new Error(body.error);
    // Compte supprimé : on ferme la session locale (redirection gérée par le provider).
    await supabase.auth.signOut();
  },

  /**
   * Connexion par téléphone (OTP SMS) — méthode ALTERNATIVE à l'email, réservée
   * aux comptes EXISTANTS. `shouldCreateUser: false` : le SMS ne crée jamais de
   * compte → l'inscription (et donc le CONSENTEMENT légal obligatoire) passe
   * toujours par l'e-mail (register.tsx). Sans ce garde-fou, un nouveau numéro
   * créait un compte sans consentement (données de santé sensibles).
   * (Nécessite un fournisseur SMS configuré dans Supabase → Auth → Phone.)
   */
  async signInWithPhone(phone: string) {
    const { error } = await supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: false } });
    if (error) throw mapAuthError(error);
  },

  /** 2) Vérifie le code à 6 chiffres et ouvre la session. */
  async verifyPhoneOtp(phone: string, token: string) {
    const { error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
    if (error) throw mapAuthError(error);
  },

  async resetPassword(email: string, redirectTo: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  },

  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (error) {
      console.warn("getProfile:", error.message);
      return null;
    }
    return data;
  },

  async updateProfile(userId: string, patch: TablesUpdate<"profiles">) {
    const { data, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", userId)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },
};
