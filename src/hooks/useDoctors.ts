import { useCallback, useEffect, useState } from "react";
import { appointmentsService, type DoctorWithProfile } from "@/lib/appointments-service";

export function useDoctors() {
  const [doctors, setDoctors] = useState<DoctorWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await appointmentsService.getDoctors();
      setDoctors(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { doctors, loading, error, reload: load };
}
