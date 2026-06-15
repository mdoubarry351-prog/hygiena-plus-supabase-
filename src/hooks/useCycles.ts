import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/providers/AuthProvider";
import { cycleService, type CyclePrediction } from "@/lib/cycle-service";
import type { MenstrualCycle } from "@/lib/database.types";

const cacheKey = (userId: string) => `cycles_cache_${userId}`;

type CachePayload = { cachedAt: string; cycles: MenstrualCycle[] };

export function useCycles() {
  const { session } = useAuth();
  const [cycles, setCycles] = useState<MenstrualCycle[]>([]);
  const [prediction, setPrediction] = useState<CyclePrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Hors-ligne : on affiche des données issues du cache (avec la date de mise en cache).
  const [offline, setOffline] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const uid = session.user.id;
    setLoading(true);
    setError(null);
    try {
      const data = await cycleService.getCycles(uid);
      setCycles(data);
      setPrediction(cycleService.computePrediction(data));
      setOffline(false);
      setCachedAt(null);
      // Met en cache les dernières données connues (best-effort).
      const payload: CachePayload = { cachedAt: new Date().toISOString(), cycles: data };
      AsyncStorage.setItem(cacheKey(uid), JSON.stringify(payload)).catch(() => {});
    } catch (e) {
      // Échec réseau → repli sur le cache si disponible.
      try {
        const raw = await AsyncStorage.getItem(cacheKey(uid));
        if (raw) {
          const parsed = JSON.parse(raw) as CachePayload;
          const cached = parsed.cycles ?? [];
          setCycles(cached);
          setPrediction(cycleService.computePrediction(cached));
          setOffline(true);
          setCachedAt(parsed.cachedAt ?? null);
          setError(null); // on a des données (du cache)
        } else {
          setError(e instanceof Error ? e.message : "Erreur de chargement");
        }
      } catch {
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      }
    } finally {
      setLoading(false);
    }
  }, [session?.user]);

  // Recharge à CHAQUE focus de l'écran (et au montage). Indispensable pour
  // refléter une saisie ajoutée/modifiée/supprimée dans un écran poussé (ex.
  // édition de la date de fin) au retour sur l'historique/calendrier/accueil.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return { cycles, prediction, loading, error, offline, cachedAt, reload: load };
}
