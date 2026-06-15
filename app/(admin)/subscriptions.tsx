import { Screen } from "@/components/Screen";
import { AdminHeader } from "@/components/AdminHeader";
import { EmptyState } from "@/components/EmptyState";

// Placeholder (Lot 1) — rempli au Lot 4 (abonnements & paiements).
export default function AdminSubscriptions() {
  return (
    <Screen>
      <AdminHeader title="Abonnements & Paiements" />
      <EmptyState icon="card-outline" title="Bientôt disponible" message="Le suivi des abonnements et paiements arrive très prochainement." />
    </Screen>
  );
}
