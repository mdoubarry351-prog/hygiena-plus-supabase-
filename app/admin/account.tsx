import { PersonalInfoEditor } from "@/components/PersonalInfoEditor";

// Édition par l'admin de SES propres informations (nom, téléphone, email, mot de
// passe) — réutilise l'éditeur partagé utilisateur/médecin.
export default function AdminAccount() {
  return <PersonalInfoEditor title="Mon compte" />;
}
