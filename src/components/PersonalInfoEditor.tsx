import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Loading } from "@/components/Loading";
import { useAuth } from "@/providers/AuthProvider";
import { authService } from "@/lib/auth-service";
import type { Profile } from "@/lib/database.types";
import { colors, spacing, typography } from "@/theme";

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

  const init = initialNames(profile);
  const [firstName, setFirstName] = useState(init.first);
  const [lastName, setLastName] = useState(init.last);
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState<Busy>(null);

  if (!profile || !session?.user) return <Loading />;
  const userId = session.user.id;

  async function saveNames() {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Nom requis", "Indiquez votre prénom et votre nom.");
      return;
    }
    setBusy("names");
    try {
      await authService.updateNames(userId, firstName.trim(), lastName.trim());
      await refreshProfile();
      Alert.alert("Enregistré", "Votre nom a été mis à jour.");
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Mise à jour échouée");
    } finally {
      setBusy(null);
    }
  }

  async function savePhone() {
    setBusy("phone");
    try {
      await authService.updatePhone(userId, phone.trim() ? phone.trim() : null);
      await refreshProfile();
      Alert.alert("Enregistré", "Votre numéro a été mis à jour.");
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Mise à jour échouée");
    } finally {
      setBusy(null);
    }
  }

  async function saveEmail() {
    const next = email.trim();
    if (!next) {
      Alert.alert("Email requis", "Saisissez une adresse email.");
      return;
    }
    setBusy("email");
    try {
      await authService.updateEmail(userId, next);
      await refreshProfile();
      Alert.alert(
        "Email mis à jour",
        "Un email de confirmation a pu être envoyé à la nouvelle adresse. Le changement sera effectif après confirmation."
      );
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Mise à jour de l'email échouée");
    } finally {
      setBusy(null);
    }
  }

  async function savePassword() {
    if (password.length < 6) {
      Alert.alert("Mot de passe trop court", "Minimum 6 caractères.");
      return;
    }
    if (password !== confirm) {
      Alert.alert("Non concordant", "Les deux mots de passe ne correspondent pas.");
      return;
    }
    setBusy("password");
    try {
      await authService.updatePassword(password);
      setPassword("");
      setConfirm("");
      Alert.alert("Mot de passe modifié", "Votre mot de passe a été mis à jour.");
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Changement de mot de passe échoué");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <ScreenHeader title={title} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Identité */}
        <Card style={styles.card}>
          <Text style={typography.h3}>Identité</Text>
          <Input label="Prénom" value={firstName} onChangeText={setFirstName} placeholder="Awa" autoCapitalize="words" />
          <Input label="Nom" value={lastName} onChangeText={setLastName} placeholder="Diop" autoCapitalize="words" />
          <Button title="Enregistrer" onPress={saveNames} loading={busy === "names"} />
        </Card>

        {/* Téléphone */}
        <Card style={styles.card}>
          <Text style={typography.h3}>Téléphone</Text>
          <Input
            label="Numéro de téléphone"
            value={phone}
            onChangeText={setPhone}
            placeholder="Ex. +224 620 00 10 01"
            keyboardType="phone-pad"
          />
          <Button title="Enregistrer" onPress={savePhone} loading={busy === "phone"} />
        </Card>

        {/* Email */}
        <Card style={styles.card}>
          <Text style={typography.h3}>Adresse email</Text>
          <Input
            label="Email"
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

        {/* Mot de passe */}
        <Card style={styles.card}>
          <Text style={typography.h3}>Mot de passe</Text>
          <Input
            label="Nouveau mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Au moins 6 caractères"
          />
          <Input
            label="Confirmer le mot de passe"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            placeholder="Retapez le mot de passe"
          />
          <Button title="Changer le mot de passe" onPress={savePassword} loading={busy === "password"} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  back: { flexDirection: "row", alignItems: "center", gap: 2, marginLeft: -spacing.xs },
  backText: { ...typography.body, color: colors.text },
  card: { gap: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted },
});
