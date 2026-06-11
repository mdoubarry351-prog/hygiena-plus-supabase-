import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { EmptyState } from "@/components/EmptyState";
import { Loading } from "@/components/Loading";
import { useAuth } from "@/providers/AuthProvider";
import { useMyDoctor } from "@/hooks/useMyDoctor";
import { doctorService } from "@/lib/doctor-service";
import { colors, radius, spacing, typography } from "@/theme";

export default function DoctorProfile() {
  const { profile, signOut } = useAuth();
  const { doctor, loading, setDoctor } = useMyDoctor();

  const [specialty, setSpecialty] = useState("");
  const [bio, setBio] = useState("");
  const [fee, setFee] = useState("");
  const [saving, setSaving] = useState(false);

  // Pré-remplit le formulaire à partir de la fiche chargée.
  useEffect(() => {
    if (doctor) {
      setSpecialty(doctor.specialty ?? "");
      setBio(doctor.bio ?? "");
      setFee(doctor.consultation_fee != null ? String(doctor.consultation_fee) : "");
    }
  }, [doctor]);

  if (loading) return <Loading />;

  if (!doctor) {
    return (
      <Screen>
        <View style={styles.topBar}><Text style={typography.h2}>Profil</Text></View>
        <EmptyState
          icon="alert-circle-outline"
          title="Fiche médecin introuvable"
          message="Aucune fiche n'est rattachée à votre compte. Contactez l'administrateur."
        />
        <View style={styles.signOutWrap}>
          <Button title="Se déconnecter" variant="danger" onPress={() => handleSignOut(signOut)} />
        </View>
      </Screen>
    );
  }

  const feeNumber = fee.trim() ? Number(fee.replace(/\s/g, "")) : null;
  const feeInvalid = fee.trim() !== "" && (feeNumber === null || Number.isNaN(feeNumber) || feeNumber < 0);

  const dirty =
    specialty.trim() !== (doctor.specialty ?? "") ||
    bio.trim() !== (doctor.bio ?? "") ||
    (feeNumber ?? null) !== (doctor.consultation_fee ?? null);

  async function handleSave() {
    if (!doctor) return;
    if (!specialty.trim()) {
      Alert.alert("Spécialité requise", "Veuillez indiquer votre spécialité.");
      return;
    }
    if (feeInvalid) {
      Alert.alert("Tarif invalide", "Le tarif de consultation doit être un nombre positif.");
      return;
    }
    setSaving(true);
    try {
      const updated = await doctorService.updateProfile(doctor.id, {
        specialty: specialty.trim(),
        bio: bio.trim() ? bio.trim() : null,
        consultation_fee: feeNumber,
      });
      setDoctor(updated);
      Alert.alert("Enregistré", "Votre fiche a été mise à jour.");
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Mise à jour échouée");
    } finally {
      setSaving(false);
    }
  }

  const initial = (profile?.full_name ?? profile?.email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={typography.h2}>Profil médecin</Text>

        <View style={styles.avatarBlock}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.name}>{profile?.full_name ?? "Médecin"}</Text>
          {profile?.email ? <Text style={styles.email}>{profile.email}</Text> : null}
        </View>

        <Card style={styles.statusCard}>
          <View style={styles.statusLeft}>
            <Ionicons
              name={doctor.is_validated ? "shield-checkmark" : "shield-outline"}
              size={22}
              color={doctor.is_validated ? colors.success : colors.textMuted}
            />
            <View style={styles.statusText}>
              <Text style={styles.statusTitle}>
                {doctor.is_validated ? "Compte validé" : "En attente de validation"}
              </Text>
              <Text style={styles.statusSub}>
                {doctor.is_validated
                  ? "Votre fiche est visible par les patientes."
                  : "Votre fiche sera visible une fois validée par un administrateur."}
              </Text>
            </View>
          </View>
        </Card>

        <Card style={styles.formCard}>
          <Text style={typography.h3}>Ma fiche</Text>
          <Input
            label="Spécialité"
            value={specialty}
            onChangeText={setSpecialty}
            placeholder="Ex. Gynécologie"
            autoCapitalize="sentences"
          />
          <Input
            label="Biographie"
            value={bio}
            onChangeText={setBio}
            placeholder="Présentez votre parcours, vos consultations…"
            multiline
            numberOfLines={5}
            style={styles.textArea}
          />
          <Input
            label="Tarif de consultation (GNF)"
            value={fee}
            onChangeText={setFee}
            placeholder="Ex. 150000"
            keyboardType="numeric"
            error={feeInvalid ? "Nombre positif attendu" : undefined}
          />
          <Button title="Enregistrer" onPress={handleSave} loading={saving} disabled={!dirty || feeInvalid} />
        </Card>

        <Button title="Se déconnecter" variant="danger" onPress={() => handleSignOut(signOut)} />
      </ScrollView>
    </Screen>
  );
}

function handleSignOut(signOut: () => Promise<void>) {
  Alert.alert("Se déconnecter", "Voulez-vous vraiment vous déconnecter ?", [
    { text: "Annuler", style: "cancel" },
    {
      text: "Se déconnecter",
      style: "destructive",
      onPress: async () => {
        try {
          await signOut();
        } catch (e) {
          Alert.alert("Erreur", e instanceof Error ? e.message : "Déconnexion échouée");
        }
      },
    },
  ]);
}

const AVATAR = 84;
const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.lg },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  avatarBlock: { alignItems: "center", gap: spacing.xs, marginVertical: spacing.sm },
  avatar: {
    width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 36, fontWeight: "700", color: colors.primaryDark },
  name: { ...typography.h3 },
  email: { ...typography.caption },
  statusCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  statusLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  statusText: { flex: 1 },
  statusTitle: { ...typography.name },
  statusSub: { ...typography.caption, marginTop: 2, flexShrink: 1 },
  formCard: { gap: spacing.sm },
  textArea: { height: 120, textAlignVertical: "top", paddingTop: spacing.sm },
  empty: { alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  muted: { color: colors.textMuted, textAlign: "center" },
  signOutWrap: { marginTop: spacing.lg },
});
