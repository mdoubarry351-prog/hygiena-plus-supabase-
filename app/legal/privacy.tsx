import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { LegalDocument } from "@/components/LegalDocument";
import { PRIVACY } from "@/lib/legal";

// Route PUBLIQUE (hors RoleGuard) — lisible avant l'inscription.
export default function PublicPrivacy() {
  return (
    <Screen>
      <ScreenHeader title={PRIVACY.title} />
      <LegalDocument doc={PRIVACY} />
    </Screen>
  );
}
