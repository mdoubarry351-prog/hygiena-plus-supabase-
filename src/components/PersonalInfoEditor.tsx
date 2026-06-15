import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Loading } from "@/components/Loading";
import { AppImage } from "@/components/AppImage";
import { FadeInView } from "@/components/FadeInView";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { authService } from "@/lib/auth-service";
import { uploadAvatar } from "@/lib/storage";
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
  const toast = useToast();

  const init = initialNames(profile);
  const [firstName, setFirstName] = useState(init.first);
  const [lastName, setLastName] = useState(init.last);
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  if (!profile || !session?.user) return <Loading />;
  const userId = session.user.id;

  // Choisit, recadre (carré), uploade la photo de profil, puis rafraîchit l'aperçu.
  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Autorisation requise", "Autorisez l'accès à vos photos pour changer votre photo de profil.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.base64) { Alert.alert("Erreur", "Impossible de lire la photo sélectionnée."); return; }
    setUploadingAvatar(true);
    try {
      const url = await uploadAvatar(asset.base64);
      await authService.updateProfile(userId, { avatar_url: url });
      await refreshProfile();
      toast.success("Photo de profil mise à jour.");
    } catch (e) {
      Alert.alert("Échec de l'envoi", e instanceof Error ? e.message : "Mise à jour de la photo échouée.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  const avatarInitial = (profile.full_name ?? profile.email ?? "?").trim().charAt(0).toUpperCase();

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
      <FadeInView>
      <ScreenHeader title={title} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Photo de profil */}
        <View style={styles.avatarBlock}>
          <Pressable onPress={pickAvatar} disabled={uploadingAvatar} style={styles.avatarWrap} accessibilityRole="button" accessibilityLabel="Changer la photo de profil">
            {profile.avatar_url ? (
              <AppImage source={profile.avatar_url} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>{avatarInitial}</Text>
              </View>
            )}
            <View style={styles.cameraBadge}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Ionicons name="camera" size={16} color={colors.white} />
              )}
            </View>
          </Pressable>
          <Text style={styles.avatarHint}>{uploadingAvatar ? "Envoi en cours…" : "Modifier la photo"}</Text>
        </View>

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
            icon="call-outline"
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

        {/* Mot de passe */}
        <Card style={styles.card}>
          <Text style={typography.h3}>Mot de passe</Text>
          <Input
            label="Nouveau mot de passe"
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            secureToggle
            validate={(v) => (v.length > 0 && v.length < 6 ? "Au moins 6 caractères." : null)}
            placeholder="Au moins 6 caractères"
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
      </ScrollView>
      </FadeInView>
    </Screen>
  );
}

const AVATAR = 96;
const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  back: { flexDirection: "row", alignItems: "center", gap: 2, marginLeft: -spacing.xs },
  backText: { ...typography.body, color: colors.text },
  card: { gap: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted },
  avatarBlock: { alignItems: "center", gap: spacing.xs, marginBottom: spacing.xs },
  avatarWrap: { width: AVATAR, height: AVATAR },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, backgroundColor: colors.primaryLight },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 36, fontWeight: "700", color: colors.primaryDark },
  cameraBadge: {
    position: "absolute", bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: colors.background,
  },
  avatarHint: { ...typography.caption, color: colors.primary, fontWeight: "700" },
});
