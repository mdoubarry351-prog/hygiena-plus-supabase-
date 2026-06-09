import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { cycleService, type CyclePrediction } from "@/lib/cycle-service";
import type { MenstrualCycle } from "@/lib/database.types";

export function useCycles() {
  const { session } = useAuth();
  const [cycles, setCycles] = useState<MenstrualCycle[]>([]);
  const [prediction, setPrediction] = useState<CyclePrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await cycleService.getCycles(session.user.id);
      setCycles(data);
      setPrediction(cycleService.computePrediction(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [session?.user]);

  useEffect(() => { load(); }, [load]);

  return { cycles, prediction, loading, error, reload: load };
}
