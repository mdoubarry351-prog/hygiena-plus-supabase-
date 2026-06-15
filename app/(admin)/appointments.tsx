import { Screen } from "@/components/Screen";
import { AdminHeader } from "@/components/AdminHeader";
import { EmptyState } from "@/components/EmptyState";

// Placeholder (Lot 1) — rempli au Lot 3 (liste des rendez-vous admin).
export default function AdminAppointments() {
  return (
    <Screen>
      <AdminHeader title="Rendez-vous" />
      <EmptyState icon="calendar-outline" title="Bientôt disponible" message="La gestion des rendez-vous arrive très prochainement." />
    </Screen>
  );
}
