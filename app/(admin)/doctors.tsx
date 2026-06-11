import { useEffect, useState, useCallback } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Loading } from "@/components/Loading";
import { AdminHeader } from "@/components/AdminHeader";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/providers/AuthProvider";
import { adminService, type DoctorRow } from "@/lib/admin-service";
import { formatPrice } from "@/lib/marketplace-service";
import { colors, radius, spacing, typography } from "@/theme";

export default function AdminDoctors() {
  const { session } = useAuth();
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
        {doctors.length === 0 ? (
          <EmptyState icon="medkit-outline" title="Aucun médecin enregistré" />
        ) : (
          doctors.map((d) => (
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
            </Card>
          ))
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
  name: { ...typography.body, fontWeight: "700" },
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
  btnText: { fontSize: 14, fontWeight: "700", color: colors.white },
});
