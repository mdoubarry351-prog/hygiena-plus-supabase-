import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { doctorService } from "@/lib/doctor-service";
import type { Doctor } from "@/lib/database.types";

// Charge la fiche doctors du médecin connecté (doctors.user_id = auth.uid()).
export function useMyDoctor() {
  const { session } = useAuth();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user) {
      setDoctor(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setDoctor(await doctorService.getMyDoctor(session.user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [session?.user]);

  useEffect(() => { load(); }, [load]);

  return { doctor, loading, error, reload: load, setDoctor };
}
