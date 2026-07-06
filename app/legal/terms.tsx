import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { LegalDocument } from "@/components/LegalDocument";
import { TERMS } from "@/lib/legal";

// Route PUBLIQUE (hors RoleGuard) — lisible avant l'inscription.
export default function PublicTerms() {
  return (
    <Screen>
      <ScreenHeader title={TERMS.title} />
      <LegalDocument doc={TERMS} />
    </Screen>
  );
}
