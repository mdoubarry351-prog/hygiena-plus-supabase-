import { useCallback, useEffect, useState } from "react";
import { appointmentsService, type DoctorWithProfile } from "@/lib/appointments-service";
import type { PractitionerType } from "@/lib/database.types";

// Liste des praticiens validés, filtrée par type (défaut : gynécologie).
export function useDoctors(practitionerType?: PractitionerType) {
  const [doctors, setDoctors] = useState<DoctorWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await appointmentsService.getDoctors({ practitionerType });
      setDoctors(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [practitionerType]);

  useEffect(() => {
    load();
  }, [load]);

  return { doctors, loading, error, reload: load };
}
