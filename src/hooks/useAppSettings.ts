import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/lib/supabase";

/**
 * Disponibilité des modules, pilotée par l'admin (table app_settings,
 * lisible par tout utilisateur authentifié via la policy settings_select_all).
 */
export type AppFlags = {
  marketplace_enabled: boolean;
  doctors_enabled: boolean;
  appointments_enabled: boolean;
  premium_enabled: boolean;
};

// Défaut prudent : tout activé. Un module n'est bloqué QUE si la valeur lue est false.
const ALL_ON: AppFlags = {
  marketplace_enabled: true,
  doctors_enabled: true,
  appointments_enabled: true,
  premium_enabled: true,
};

/**
 * Lit l'unique ligne de app_settings et expose les 4 booléens.
 * Se recharge à chaque focus de l'écran pour refléter vite un changement admin.
 */
export function useAppSettings(): AppFlags & { loading: boolean; reload: () => Promise<void> } {
  const [flags, setFlags] = useState<AppFlags>(ALL_ON);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("marketplace_enabled, doctors_enabled, appointments_enabled, premium_enabled")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setFlags({
          marketplace_enabled: data.marketplace_enabled ?? true,
          doctors_enabled: data.doctors_enabled ?? true,
          appointments_enabled: data.appointments_enabled ?? true,
          premium_enabled: data.premium_enabled ?? true,
        });
      } else {
        // Ligne absente → on n'empêche rien par erreur.
        setFlags(ALL_ON);
      }
    } catch {
      // Erreur de lecture → ne pas bloquer tous les services.
      setFlags(ALL_ON);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  return { ...flags, loading, reload };
}

/** Message unique à afficher quand un module désactivé par l'admin est sollicité. */
export function showServiceUnavailable(): void {
  Alert.alert("Service non disponible pour le moment");
}
