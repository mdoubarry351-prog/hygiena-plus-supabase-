import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/providers/AuthProvider";
import { cycleService, type CyclePrediction } from "@/lib/cycle-service";
import {
  applyPendingOps,
  flushPendingCycles,
  pendingCount,
  readCyclesCache,
  writeCyclesCache,
} from "@/lib/cycle-offline";
import type { MenstrualCycle } from "@/lib/database.types";

// Délai max accordé au réseau avant de considérer qu'on est hors-ligne.
// (Sans ça, une connexion moribonde bloque l'écran de longues secondes.)
const NETWORK_TIMEOUT_MS = 8000;

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("network timeout")), NETWORK_TIMEOUT_MS)),
  ]);
}

/**
 * Saisies de cycle avec stratégie HORS-LIGNE D'ABORD :
 * 1. Le cache local s'affiche IMMÉDIATEMENT (zéro attente, même sans réseau),
 *    écritures en attente incluses (saisies faites hors-ligne).
 * 2. En arrière-plan : synchronisation de la file d'attente puis rafraîchissement
 *    réseau (timeout court). Succès → données fraîches + cache mis à jour.
 *    Échec → on reste sur le cache, bannière hors-ligne (offline + cachedAt).
 */
export function useCycles() {
  const { session } = useAuth();
  const [cycles, setCycles] = useState<MenstrualCycle[]>([]);
  const [prediction, setPrediction] = useState<CyclePrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  // Nombre de saisies en attente de synchronisation (affichable si besoin).
  const [pending, setPending] = useState(0);
  // Évite que deux load() concurrents (focus rapprochés) ne s'entremêlent.
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const uid = session.user.id;
    const mySeq = ++seq.current;
    setError(null);

    // 1) CACHE D'ABORD : affichage instantané (avec les écritures en attente).
    const cache = await readCyclesCache(uid);
    if (cache && seq.current === mySeq) {
      setCycles(cache.cycles);
      setPrediction(cycleService.computePrediction(cache.cycles));
      setLoading(false); // l'utilisatrice voit ses données tout de suite
    } else {
      setLoading(true); // premier lancement : rien en cache
    }
    setPending(await pendingCount(uid));

    // 2) ARRIÈRE-PLAN : file d'attente puis rafraîchissement réseau.
    try {
      await withTimeout(flushPendingCycles(uid));
      const data = await withTimeout(cycleService.getCycles(uid));
      if (seq.current !== mySeq) return;
      setCycles(data);
      setPrediction(cycleService.computePrediction(data));
      setOffline(false);
      setCachedAt(null);
      setPending(await pendingCount(uid));
      writeCyclesCache(uid, data);
    } catch (e) {
      if (seq.current !== mySeq) return;
      if (cache) {
        // Hors-ligne avec cache : les données restent affichées, on le signale.
        setOffline(true);
        setCachedAt(cache.cachedAt ?? null);
      } else {
        // Premier lancement ET hors-ligne : rien à montrer.
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      }
    } finally {
      if (seq.current === mySeq) setLoading(false);
    }
  }, [session?.user]);

  // Recharge à CHAQUE focus de l'écran (et au montage). Indispensable pour
  // refléter une saisie ajoutée/modifiée/supprimée dans un écran poussé (ex.
  // édition de la date de fin) au retour sur l'historique/calendrier/accueil.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return { cycles, prediction, loading, error, offline, cachedAt, pending, reload: load };
}
