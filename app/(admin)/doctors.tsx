import { useEffect, useState, useCallback } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Loading } from "@/components/Loading";
import { AdminHeader } from "@/components/AdminHeader";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/providers/AuthProvider";
import { adminService, type DoctorRow } from "@/lib/admin-service";
import type { Profile } from "@/lib/database.types";
import { formatPrice } from "@/lib/marketplace-service";
import { colors, radius, spacing, typography } from "@/theme";

export default function AdminDoctors() {
  const { session } = useAuth();
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Flux "Ajouter un médecin" (promotion d'un compte existant)
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [picked, setPicked] = useState<Profile | null>(null);
  const [specialty, setSpecialty] = useState("");
  const [clinic, setClinic] = useState("");
  const [bio, setBio] = useState("");
  const [fee, setFee] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDoctors(await adminService.getDoctors());
    } catch {
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function resetAdd() {
    setAdding(false);
    setSearch(""); setResults([]); setPicked(null);
    setSpecialty(""); setClinic(""); setBio(""); setFee("");
  }

  async function runSearch() {
    if (!search.trim()) return;
    try {
      const found = await adminService.getUsers(search);
      // On ne propose que des comptes "utilisateur" (ni médecin déjà, ni admin).
      setResults(found.filter((u) => u.role === "user"));
    } catch {
      setResults([]);
    }
  }

  async function submitAdd() {
    if (!session?.user || !picked) return;
    if (!specialty.trim()) {
      Alert.alert("Spécialité requise", "Veuillez indiquer la spécialité du médecin.");
      return;
    }
    const feeNum = fee.trim() ? Number(fee.replace(/\s/g, "")) : null;
    if (fee.trim() && (feeNum === null || Number.isNaN(feeNum) || feeNum < 0)) {
      Alert.alert("Tarif invalide", "Le tarif doit être un nombre positif.");
      return;
    }
    setSaving(true);
    try {
      await adminService.addDoctor(session.user.id, picked.id, {
        specialty: specialty.trim(),
        bio: bio.trim() || null,
        consultation_fee: feeNum,
        clinic_name: clinic.trim() || null,
      });
      resetAdd();
      await load();
      Alert.alert("Médecin ajouté", "Le compte a été promu médecin et sa fiche est validée.");
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Ajout échoué");
    } finally {
      setSaving(false);
    }
  }

  function demote(d: DoctorRow) {
    if (!session?.user) return;
    Alert.alert(
      "Retirer le statut médecin ?",
      `${d.profile?.full_name ?? "Ce médecin"} redeviendra un utilisateur simple et sa fiche médecin sera supprimée. Le compte est conservé.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Retirer",
          style: "destructive",
          onPress: async () => {
            try {
              await adminService.demoteDoctor(session.user.id, { id: d.id, user_id: d.user_id });
              setDoctors((prev) => prev.filter((x) => x.id !== d.id));
              Alert.alert("Statut retiré", "Le compte est redevenu utilisateur simple.");
            } catch (e) {
              Alert.alert("Erreur", e instanceof Error ? e.message : "Action échouée");
            }
          },
        },
      ]
    );
  }

  function deleteDoctor(d: DoctorRow) {
    if (!session?.user) return;
    Alert.alert(
      "Supprimer définitivement ?",
      `Le compte de ${d.profile?.full_name ?? "ce médecin"} et toutes ses données seront supprimés. Cette action est IRRÉVERSIBLE.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await adminService.deleteDoctorAccount(session.user.id, d.user_id);
              setDoctors((prev) => prev.filter((x) => x.id !== d.id));
              Alert.alert("Supprimé", "Le compte médecin a été supprimé définitivement.");
            } catch (e) {
              Alert.alert("Erreur", e instanceof Error ? e.message : "Suppression échouée");
            }
          },
        },
      ]
    );
  }

  function setValidation(d: DoctorRow, validate: boolean) {
    if (!session?.user) return;
    Alert.alert(
      validate ? "Valider ce médecin ?" : "Refuser ce médecin ?",
      validate ? "Sa fiche deviendra visible par les patientes." : "Sa fiche ne sera plus visible.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: validate ? "Valider" : "Refuser",
          style: validate ? "default" : "destructive",
          onPress: async () => {
            try {
              await adminService.setDoctorValidation(session.user.id, d.id, validate);
              setDoctors((prev) => prev.map((x) => (x.id === d.id ? { ...x, is_validated: validate } : x)));
            } catch (e) {
              Alert.alert("Erreur", e instanceof Error ? e.message : "Action échouée");
            }
          },
        },
      ]
    );
  }

  if (loading && doctors.length === 0) return <Loading />;

  return (
    <Screen>
      <AdminHeader title="Médecins" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {adding ? (
          <Card style={styles.addCard}>
            <View style={styles.addHead}>
              <Text style={typography.h3}>Ajouter un médecin</Text>
              <Pressable onPress={resetAdd} hitSlop={8}><Ionicons name="close" size={20} color={colors.textMuted} /></Pressable>
            </View>
            <Text style={styles.note}>
              On promeut un compte EXISTANT en médecin. La personne doit déjà s'être inscrite sur l'application.
            </Text>
            {picked ? (
              <>
                <View style={styles.pickedRow}>
                  <Text style={styles.pickedName}>{picked.full_name ?? picked.email ?? "Utilisateur"}</Text>
                  <Pressable onPress={() => setPicked(null)} hitSlop={8}><Ionicons name="close" size={16} color={colors.textMuted} /></Pressable>
                </View>
                <Input label="Spécialité *" value={specialty} onChangeText={setSpecialty} placeholder="Ex. Gynécologie" autoCapitalize="sentences" />
                <Input label="Nom de la clinique" value={clinic} onChangeText={setClinic} placeholder="Ex. Clinique Hygiena, Conakry" autoCapitalize="sentences" />
                <Input label="Biographie" value={bio} onChangeText={setBio} placeholder="Parcours, consultations…" multiline numberOfLines={4} style={styles.textArea} />
                <Input label="Tarif de consultation (GNF)" value={fee} onChangeText={setFee} placeholder="Ex. 150000" keyboardType="numeric" />
                <Button title="Ajouter le médecin" onPress={submitAdd} loading={saving} />
              </>
            ) : (
              <>
                <Input
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Rechercher un utilisateur…"
                  autoCapitalize="none"
                  returnKeyType="search"
                  onSubmitEditing={runSearch}
                  style={styles.searchInput}
                />
                {results.map((u) => (
                  <Pressable key={u.id} onPress={() => { setPicked(u); setResults([]); }}>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultName}>{u.full_name ?? "Sans nom"}</Text>
                      <Text style={styles.resultEmail}>{u.email ?? "—"}</Text>
                    </View>
                  </Pressable>
                ))}
              </>
            )}
          </Card>
        ) : (
          <Pressable onPress={() => setAdding(true)} style={styles.addToggle}>
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.addToggleText}>Ajouter un médecin</Text>
          </Pressable>
        )}

        {doctors.length === 0 ? (
          <EmptyState icon="medkit-outline" title="Aucun médecin enregistré" />
        ) : (
          doctors.map((d) => {
            const isSelf = session?.user?.id === d.user_id;
            return (
            <Card key={d.id} style={styles.card}>
              <View style={styles.head}>
                <View style={styles.info}>
                  <Text style={styles.name}>{d.profile?.full_name ?? "Médecin"}</Text>
                  <Text style={styles.specialty}>{d.specialty}</Text>
                  <Text style={styles.meta}>{d.profile?.email ?? "—"}</Text>
                </View>
                <Text style={[styles.badge, d.is_validated ? styles.badgeOk : styles.badgePending]}>
                  {d.is_validated ? "Validé" : "En attente"}
                </Text>
              </View>
              <View style={styles.metaRow}>
                {d.license_number ? <Text style={styles.meta}>Licence : {d.license_number}</Text> : null}
                {d.consultation_fee != null ? <Text style={styles.meta}>{formatPrice(d.consultation_fee)}</Text> : null}
              </View>
              {d.bio ? <Text style={styles.bio} numberOfLines={3}>{d.bio}</Text> : null}
              <View style={styles.actions}>
                {!d.is_validated ? (
                  <Pressable onPress={() => setValidation(d, true)} style={[styles.btn, { backgroundColor: colors.success }]}>
                    <Ionicons name="checkmark" size={16} color={colors.white} />
                    <Text style={styles.btnText}>Valider</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => setValidation(d, false)} style={[styles.btn, styles.btnOutline]}>
                    <Ionicons name="close" size={16} color={colors.danger} />
                    <Text style={[styles.btnText, { color: colors.danger }]}>Révoquer</Text>
                  </Pressable>
                )}
              </View>
              {isSelf ? (
                <Text style={styles.selfNote}>C'est votre compte : retrait/suppression indisponibles.</Text>
              ) : (
                <View style={styles.actions}>
                  <Pressable onPress={() => demote(d)} style={[styles.btn, styles.btnOutlineMuted]}>
                    <Ionicons name="person-remove-outline" size={16} color={colors.textMuted} />
                    <Text style={[styles.btnText, { color: colors.textMuted }]}>Retirer le statut</Text>
                  </Pressable>
                  <Pressable onPress={() => deleteDoctor(d)} style={[styles.btn, styles.btnOutline]}>
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    <Text style={[styles.btnText, { color: colors.danger }]}>Supprimer</Text>
                  </Pressable>
                </View>
              )}
            </Card>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  empty: { alignItems: "center" },
  muted: { color: colors.textMuted },
  card: { gap: spacing.sm },
  head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  info: { flex: 1, gap: 2 },
  name: { ...typography.name },
  specialty: { ...typography.caption, color: colors.secondary, fontWeight: "600" },
  meta: { ...typography.caption, color: colors.textMuted },
  metaRow: { flexDirection: "row", gap: spacing.lg },
  bio: { ...typography.caption, color: colors.text },
  badge: { ...typography.caption, color: colors.white, fontWeight: "700", paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, overflow: "hidden" },
  badgeOk: { backgroundColor: colors.success },
  badgePending: { backgroundColor: colors.accent },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  btn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, height: 44, borderRadius: radius.md },
  btnOutline: { borderWidth: 1.5, borderColor: colors.danger },
  btnOutlineMuted: { borderWidth: 1.5, borderColor: colors.border },
  btnText: { fontSize: 14, fontWeight: "700", color: colors.white },
  selfNote: { ...typography.caption, color: colors.textMuted, fontStyle: "italic", marginTop: spacing.xs },
  // Flux "Ajouter un médecin"
  addToggle: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary, borderStyle: "dashed" },
  addToggleText: { ...typography.name, color: colors.primary },
  addCard: { gap: spacing.sm },
  addHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  note: { ...typography.caption, color: colors.textMuted },
  searchInput: { marginBottom: 0 },
  resultRow: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  resultName: { ...typography.name },
  resultEmail: { ...typography.caption, color: colors.textMuted },
  pickedRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.xs },
  pickedName: { ...typography.name },
  textArea: { height: 100, textAlignVertical: "top", paddingTop: spacing.sm },
});
