import { supabase } from "@/lib/supabase";
import type { HealthProfile, TablesInsert } from "@/lib/database.types";

// Groupes sanguins proposés (sélecteur). Valeurs stockées telles quelles.
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export const healthService = {
  // Lit la fiche santé de l'utilisatrice (null si non encore renseignée).
  async getHealthProfile(userId: string): Promise<HealthProfile | null> {
    const { data, error } = await supabase
      .from("health_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  },

  // Crée ou met à jour la fiche santé (upsert sur user_id, clé primaire).
  async upsertHealthProfile(
    userId: string,
    patch: Omit<TablesInsert<"health_profiles">, "user_id">
  ): Promise<HealthProfile> {
    const payload: TablesInsert<"health_profiles"> = {
      user_id: userId,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("health_profiles")
      .upsert(payload, { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },
};
