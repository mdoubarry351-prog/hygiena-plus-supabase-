import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { EmptyState } from "@/components/EmptyState";
import { Loading } from "@/components/Loading";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";
import { useAuth } from "@/providers/AuthProvider";
import { useMyDoctor } from "@/hooks/useMyDoctor";
import { doctorService } from "@/lib/doctor-service";
import { uploadKycDocument } from "@/lib/storage";
import { colors, radius, spacing, typography } from "@/theme";

export default function DoctorProfile() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const { doctor, loading, setDoctor } = useMyDoctor();

  const [specialty, setSpecialty] = useState("");
  const [clinic, setClinic] = useState("");
  const [bio, setBio] = useState("");
  const [fee, setFee] = useState("");
  const [saving, setSaving] = useState(false);
  const [kycUploading, setKycUploading] = useState(false);

  // Pré-remplit le formulaire à partir de la fiche chargée.
  useEffect(() => {
    if (doctor) {
      setSpecialty(doctor.specialty ?? "");
      setClinic(doctor.clinic_name ?? "");
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
    clinic.trim() !== (doctor.clinic_name ?? "") ||
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
        clinic_name: clinic.trim() ? clinic.trim() : null,
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

  // Téléverse (ou remplace) le document de vérification dans le bucket privé.
  async function pickKycDocument() {
    if (!doctor) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Autorisation requise", "Autorisez l'accès à vos photos pour téléverser votre document.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.base64) { Alert.alert("Erreur", "Impossible de lire le document sélectionné."); return; }
    setKycUploading(true);
    try {
      const path = await uploadKycDocument(asset.base64);
      const updated = await doctorService.updateLicenseDocument(doctor.id, path);
      setDoctor(updated);
      Alert.alert("Document envoyé", "Votre document a été transmis. Il sera vérifié par un administrateur.");
    } catch (e) {
      Alert.alert("Échec de l'envoi", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setKycUploading(false);
    }
  }

  // État du document de vérification.
  const kyc = doctor.is_validated
    ? { icon: "shield-checkmark" as const, color: colors.success, label: "Vérifié ✓", sub: "Votre document a été validé." }
    : doctor.license_document_url
    ? { icon: "time-outline" as const, color: colors.accent, label: "Document fourni — en attente de vérification", sub: "Un administrateur va vérifier votre document." }
    : { icon: "document-outline" as const, color: colors.textMuted, label: "Aucun document", sub: "Téléversez votre licence ou diplôme pour être vérifié." };

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

        {/* Document de vérification (KYC) — bucket privé */}
        <Card style={styles.kycCard}>
          <Text style={typography.h3}>Document de vérification</Text>
          <View style={styles.kycStatus}>
            <Ionicons name={kyc.icon} size={20} color={kyc.color} />
            <View style={styles.kycText}>
              <Text style={styles.kycLabel}>{kyc.label}</Text>
              <Text style={styles.kycSub}>{kyc.sub}</Text>
            </View>
          </View>
          {!doctor.is_validated ? (
            <Pressable onPress={pickKycDocument} disabled={kycUploading} style={[styles.kycBtn, kycUploading && styles.kycBtnDisabled]}>
              {kycUploading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
                  <Text style={styles.kycBtnText}>{doctor.license_document_url ? "Remplacer le document" : "Téléverser un document"}</Text>
                </>
              )}
            </Pressable>
          ) : null}
        </Card>

        {/* Infos personnelles (distinctes de la fiche pro) */}
        <Pressable onPress={() => router.push("/(doctor)/account")}>
          <Card style={styles.accountRow}>
            <View style={styles.accountIcon}>
              <Ionicons name="person-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.accountText}>
              <Text style={styles.accountTitle}>Mes informations personnelles</Text>
              <Text style={styles.accountSub}>Nom, téléphone, email, mot de passe</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Card>
        </Pressable>

        <Card style={styles.formCard}>
          <Text style={typography.h3}>Fiche professionnelle</Text>
          <Input
            label="Spécialité"
            value={specialty}
            onChangeText={setSpecialty}
            placeholder="Ex. Gynécologie"
            autoCapitalize="sentences"
          />
          <Input
            label="Nom de la clinique"
            value={clinic}
            onChangeText={setClinic}
            placeholder="Ex. Clinique Hygiena Santé, Conakry"
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

        <Button title="Se déconnecter" variant="outline" onPress={() => handleSignOut(signOut)} />

        <DeleteAccountButton />
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
  kycCard: { gap: spacing.sm },
  kycStatus: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  kycText: { flex: 1 },
  kycLabel: { ...typography.name },
  kycSub: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  kycBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary },
  kycBtnDisabled: { opacity: 0.6 },
  kycBtnText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
  accountRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  accountIcon: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  accountText: { flex: 1, gap: 2 },
  accountTitle: { ...typography.name },
  accountSub: { ...typography.caption, color: colors.textMuted },
  textArea: { height: 120, textAlignVertical: "top", paddingTop: spacing.sm },
  empty: { alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  muted: { color: colors.textMuted, textAlign: "center" },
  signOutWrap: { marginTop: spacing.lg },
});
