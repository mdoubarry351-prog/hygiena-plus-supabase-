import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { PhoneInput } from "@/components/PhoneInput";
import { Loading } from "@/components/Loading";
import { FadeInView } from "@/components/FadeInView";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { authService } from "@/lib/auth-service";
import { onlyDigits, toE164, isValidGuineaLocal, formatStoredPhone } from "@/lib/phone";
import { passwordIssue, PASSWORD_MIN_LENGTH } from "@/lib/validation";
import { hapticSuccess } from "@/lib/haptics";
import type { Profile } from "@/lib/database.types";
import { colors, spacing, typography } from "@/theme";

const STEP = 55; // pas de l'apparition échelonnée
type Busy = "names" | "phone" | "email" | "password" | null;

// Prénom/Nom initiaux : depuis first_name/last_name, sinon dérivés de full_name.
function initialNames(profile: Profile | null): { first: string; last: string } {
  if (profile?.first_name || profile?.last_name) {
    return { first: profile.first_name ?? "", last: profile.last_name ?? "" };
  }
  const parts = (profile?.full_name ?? "").trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

// Éditeur d'informations personnelles partagé (utilisateur ET médecin).
// Présentation + appels auth-service uniquement ; full_name reste synchronisé.
export function PersonalInfoEditor({ title = "Mes informations" }: { title?: string }) {
  const { profile, session, refreshProfile } = useAuth();
  const toast = useToast();

  const init = initialNames(profile);
  const [firstName, setFirstName] = useState(init.first);
  const [lastName, setLastName] = useState(init.last);
  // Affichage formaté à tirets (numéro stocké E.164 → parsé pour pré-remplir).
  const [phone, setPhone] = useState(formatStoredPhone(profile?.phone));
  const [email, setEmail] = useState(profile?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState<Busy>(null);

  if (!profile || !session?.user) return <Loading />;
  const userId = session.user.id;

  async function saveNames() {
    if (!firstName.trim() || !lastName.trim()) {
      toast.info("Indique ton prénom et ton nom.");
      return;
    }
    setBusy("names");
    try {
      await authService.updateNames(userId, firstName.trim(), lastName.trim());
      await refreshProfile();
      hapticSuccess();
      toast.success("Ton nom a été mis à jour.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Mise à jour échouée");
    } finally {
      setBusy(null);
    }
  }

  async function savePhone() {
    const local = onlyDigits(phone);
    if (local && !isValidGuineaLocal(local)) {
      toast.info("Saisissez un numéro guinéen à 9 chiffres (ou laissez vide).");
      return;
    }
    setBusy("phone");
    try {
      // Stocké en E.164 « +224… » (vide → null pour effacer le numéro).
      await authService.updatePhone(userId, local ? toE164(local) : null);
      await refreshProfile();
      hapticSuccess();
      toast.success("Ton numéro a été mis à jour.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Mise à jour échouée");
    } finally {
      setBusy(null);
    }
  }

  async function saveEmail() {
    const next = email.trim();
    if (!next) {
      toast.info("Saisis une adresse email.");
      return;
    }
    setBusy("email");
    try {
      await authService.updateEmail(userId, next);
      await refreshProfile();
      hapticSuccess();
      toast.success("Un email de confirmation a pu être envoyé à la nouvelle adresse. Le changement sera effectif après confirmation.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Mise à jour de l'email échouée");
    } finally {
      setBusy(null);
    }
  }

  async function savePassword() {
    const issue = passwordIssue(password);
    if (issue) {
      toast.info(issue);
      return;
    }
    if (password !== confirm) {
      toast.info("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setBusy("password");
    try {
      await authService.updatePassword(password);
      setPassword("");
      setConfirm("");
      hapticSuccess();
      toast.success("Ton mot de passe a été mis à jour.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Changement de mot de passe échoué");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <View style={styles.fill}>
      <ScreenHeader title={title} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Identité */}
        <FadeInView fill={false} delay={0}>
        <Card style={styles.card}>
          <Text style={typography.h3}>Identité</Text>
          <Input label="Prénom" value={firstName} onChangeText={setFirstName} placeholder="Awa" autoCapitalize="words" />
          <Input label="Nom" value={lastName} onChangeText={setLastName} placeholder="Diop" autoCapitalize="words" />
          <Button title="Enregistrer" onPress={saveNames} loading={busy === "names"} />
        </Card>
        </FadeInView>

        {/* Téléphone */}
        <FadeInView fill={false} delay={STEP}>
        <Card style={styles.card}>
          <Text style={typography.h3}>Téléphone</Text>
          <PhoneInput
            label="Numéro de téléphone"
            value={phone}
            onChangeText={(f) => setPhone(f)}
          />
          <Button title="Enregistrer" onPress={savePhone} loading={busy === "phone"} />
        </Card>
        </FadeInView>

        {/* Email */}
        <FadeInView fill={false} delay={STEP * 2}>
        <Card style={styles.card}>
          <Text style={typography.h3}>Adresse email</Text>
          <Input
            label="Email"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            placeholder="vous@exemple.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
          <Text style={styles.hint}>Un email de confirmation peut être envoyé à la nouvelle adresse.</Text>
          <Button title="Mettre à jour l'email" onPress={saveEmail} loading={busy === "email"} />
        </Card>
        </FadeInView>

        {/* Mot de passe */}
        <FadeInView fill={false} delay={STEP * 3}>
        <Card style={styles.card}>
          <Text style={typography.h3}>Mot de passe</Text>
          <Input
            label="Nouveau mot de passe"
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            secureToggle
            validate={(v) => (v.length > 0 ? passwordIssue(v) : null)}
            placeholder={`Au moins ${PASSWORD_MIN_LENGTH} caractères`}
          />
          <Input
            label="Confirmer le mot de passe"
            icon="lock-closed-outline"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            secureToggle
            validate={(v) => (v.length > 0 && v !== password ? "Les mots de passe ne correspondent pas." : null)}
            placeholder="Retapez le mot de passe"
          />
          <Button title="Changer le mot de passe" onPress={savePassword} loading={busy === "password"} />
        </Card>
        </FadeInView>
      </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  back: { flexDirection: "row", alignItems: "center", gap: 2, marginLeft: -spacing.xs },
  backText: { ...typography.body, color: colors.text },
  card: { gap: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted },
});
