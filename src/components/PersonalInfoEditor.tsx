import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Avatar } from "@/components/Avatar";
import { PhoneInput } from "@/components/PhoneInput";
import { Loading } from "@/components/Loading";
import { FadeInView } from "@/components/FadeInView";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { authService } from "@/lib/auth-service";
import { uploadAvatar } from "@/lib/storage";
import { onlyDigits, toE164, isValidGuineaLocal, formatStoredPhone } from "@/lib/phone";
import { passwordIssue, PASSWORD_MIN_LENGTH } from "@/lib/validation";
import { hapticSuccess } from "@/lib/haptics";
import type { Profile } from "@/lib/database.types";
import { colors, radius, shadows, spacing, typography } from "@/theme";

const STEP = 55; // pas de l'apparition échelonnée
const AVATAR = 84;
type Busy = "info" | "password" | "avatar" | null;

// Prénom/Nom initiaux : depuis first_name/last_name, sinon dérivés de full_name.
function initialNames(profile: Profile | null): { first: string; last: string } {
  if (profile?.first_name || profile?.last_name) {
    return { first: profile.first_name ?? "", last: profile.last_name ?? "" };
  }
  const parts = (profile?.full_name ?? "").trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

// Éditeur d'informations personnelles partagé (utilisateur, médecin, admin).
// Design « La Carte » : en-tête d'identité (avatar modifiable + nom + email),
// UN formulaire consolidé avec un seul enregistrement, carte mot de passe, et
// — si `showDeleteAccount` — une zone sensible pour supprimer son compte.
export function PersonalInfoEditor({
  title = "Mon profil",
  showDeleteAccount = false,
}: {
  title?: string;
  showDeleteAccount?: boolean;
}) {
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
  // Valeurs de référence (profil narrowé) pour le diff d'enregistrement.
  const currentPhone = profile.phone ?? null;
  const currentEmail = profile.email ?? "";

  const fullName =
    profile.full_name?.trim() ||
    [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();

  // Photo de profil : sélection galerie → upload avatar → maj profiles.avatar_url.
  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.error("Autorisation requise : autorise l'accès à tes photos pour changer ta photo de profil.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      // iOS : transcode les HEIC en JPEG dès la sélection (formats du bucket).
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.base64) { toast.error("Impossible de lire la photo sélectionnée."); return; }
    setBusy("avatar");
    try {
      const url = await uploadAvatar(asset.base64);
      await authService.updateProfile(userId, { avatar_url: url });
      await refreshProfile();
      hapticSuccess();
      toast.success("Ta photo de profil a été enregistrée.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Mise à jour de la photo échouée.");
    } finally {
      setBusy(null);
    }
  }

  // Enregistrement consolidé : n'appelle QUE les services dont la valeur a changé
  // (éviter de re-déclencher un email de confirmation pour un email inchangé).
  async function saveInfo() {
    if (!firstName.trim() || !lastName.trim()) {
      toast.info("Indique ton prénom et ton nom.");
      return;
    }
    const local = onlyDigits(phone);
    if (local && !isValidGuineaLocal(local)) {
      toast.info("Saisis un numéro guinéen à 9 chiffres (ou laisse vide).");
      return;
    }
    const namesChanged = firstName.trim() !== init.first || lastName.trim() !== init.last;
    const nextPhone = local ? toE164(local) : null;
    const phoneChanged = nextPhone !== currentPhone;
    const nextEmail = email.trim();
    const emailChanged = !!nextEmail && nextEmail !== currentEmail;

    if (!namesChanged && !phoneChanged && !emailChanged) {
      toast.info("Aucune modification à enregistrer.");
      return;
    }
    setBusy("info");
    try {
      if (namesChanged) await authService.updateNames(userId, firstName.trim(), lastName.trim());
      if (phoneChanged) await authService.updatePhone(userId, nextPhone);
      if (emailChanged) await authService.updateEmail(userId, nextEmail);
      await refreshProfile();
      hapticSuccess();
      toast.success(
        emailChanged
          ? "Modifications enregistrées. Un email de confirmation a pu être envoyé à ta nouvelle adresse."
          : "Tes informations ont été mises à jour."
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Mise à jour échouée");
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

          {/* En-tête identité — « La Carte » */}
          <FadeInView fill={false} delay={0}>
            <View style={styles.hero}>
              <Pressable onPress={pickAvatar} disabled={busy === "avatar"} style={styles.avatarWrap} accessibilityRole="button" accessibilityLabel="Changer ma photo de profil">
                <View style={styles.avatarRing}>
                  <Avatar uri={profile.avatar_url} name={fullName || profile.email} size={AVATAR} />
                </View>
                <View style={styles.avatarEdit}>
                  {busy === "avatar" ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Ionicons name="camera" size={15} color={colors.white} />
                  )}
                </View>
              </Pressable>
              {fullName ? <Text style={styles.heroName}>{fullName}</Text> : null}
              {profile.email ? <Text style={styles.heroEmail}>{profile.email}</Text> : null}
            </View>
          </FadeInView>

          {/* Informations — un seul enregistrement */}
          <FadeInView fill={false} delay={STEP}>
            <Card style={styles.card}>
              <Text style={typography.h3}>Mes informations</Text>
              <Input label="Prénom" value={firstName} onChangeText={setFirstName} placeholder="Awa" autoCapitalize="words" />
              <Input label="Nom" value={lastName} onChangeText={setLastName} placeholder="Diop" autoCapitalize="words" />
              <PhoneInput label="Numéro de téléphone" value={phone} onChangeText={(f) => setPhone(f)} />
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
              <Button title="Enregistrer les modifications" onPress={saveInfo} loading={busy === "info"} />
            </Card>
          </FadeInView>

          {/* Mot de passe — action distincte (sensible, avec confirmation) */}
          <FadeInView fill={false} delay={STEP * 2}>
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

          {/* Zone sensible — suppression de compte (utilisateur uniquement) */}
          {showDeleteAccount ? (
            <FadeInView fill={false} delay={STEP * 3}>
              <DeleteAccountButton />
            </FadeInView>
          ) : null}
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  // En-tête identité : bandeau violet arrondi, avatar centré, nom + email.
  hero: {
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    ...shadows.md,
  },
  avatarWrap: { position: "relative" },
  avatarRing: { padding: 4, borderRadius: (AVATAR + 8) / 2, backgroundColor: colors.white, ...shadows.sm },
  avatarEdit: {
    position: "absolute", right: -2, bottom: -2,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.accent,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: colors.white,
  },
  heroName: { ...typography.h3, color: colors.white, marginTop: spacing.xs },
  heroEmail: { ...typography.caption, color: colors.white, opacity: 0.9 },
  card: { gap: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted },
});
