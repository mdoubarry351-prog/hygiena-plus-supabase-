import { supabase } from "./supabase";
import type { Profile, TablesUpdate } from "./database.types";

/**
 * Service d'authentification. Centralise tous les appels Supabase Auth
 * + la lecture/écriture du profil applicatif (table public.profiles).
 */
export const authService = {
  async signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  /**
   * Inscription. Le profil est créé côté DB par le trigger on_auth_user_created.
   * On complète ensuite full_name (et autres champs) si la session est active.
   */
  async signUp(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    // Si la confirmation email est désactivée, une session existe déjà :
    // on peut alors compléter le profil. Sinon, ce sera fait à la 1re connexion.
    if (data.session && data.user) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: fullName, email })
        .eq("id", data.user.id);
      if (profileError) {
        // Non bloquant : le profil de base existe déjà via le trigger.
        console.warn("Complétion du profil échouée:", profileError.message);
      }
    }

    return { needsEmailConfirmation: !data.session };
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * Connexion par téléphone (OTP SMS) — méthode ALTERNATIVE à l'email.
   * 1) Envoie le code par SMS. Crée le compte si le numéro est nouveau.
   *    (Nécessite un fournisseur SMS configuré dans Supabase → Auth → Phone.)
   */
  async signInWithPhone(phone: string) {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw error;
  },

  /** 2) Vérifie le code à 6 chiffres et ouvre la session. */
  async verifyPhoneOtp(phone: string, token: string) {
    const { error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
    if (error) throw error;
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
