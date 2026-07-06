import { useEffect, useRef, useState, useCallback } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Loading } from "@/components/Loading";
import { EmptyState } from "@/components/EmptyState";
import { AdminHeader } from "@/components/AdminHeader";
import { SegmentedControl } from "@/components/SegmentedControl";
import { AdminAppointmentCard } from "@/components/AdminAppointmentCard";
import { adminService, type ConsultationsSummary, type AdminAppointmentRow } from "@/lib/admin-service";
import { formatPrice } from "@/lib/marketplace-service";
import type { AppointmentStatus } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

const TITLE = "Consultations & paiements";
const APPT_PAGE = 30;

type Filter = "all" | AppointmentStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "confirmed", label: "Confirmé" },
  { key: "pending", label: "En attente" },
  { key: "completed", label: "Terminé" },
  { key: "cancelled", label: "Annulé" },
];

export default function AdminSubscriptions() {
  const [data, setData] = useState<ConsultationsSummary | null>(null);
  const [appts, setAppts] = useState<AdminAppointmentRow[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const filterRef = useRef<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const summary = await adminService.getConsultationsAdmin();
      setData(summary);
      const list = await adminService.getAppointmentsAdmin({
        status: filterRef.current === "all" ? null : filterRef.current,
        limit: APPT_PAGE,
        offset: 0,
      });
      setAppts(list);
    } catch {
      setData(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Recharge au montage et au changement de filtre.
  useEffect(() => {
    filterRef.current = filter;
    load();
  }, [filter, load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading && !data) return (
    <Screen><AdminHeader title={TITLE} /><Loading /></Screen>
  );

  if (error || !data) return (
    <Screen>
      <AdminHeader title={TITLE} />
      <EmptyState icon="cloud-offline-outline" title="Données indisponibles" message="Impossible de charger les données pour le moment." actionLabel="Réessayer" onAction={load} />
    </Screen>
  );

  const SUMMARY = [
    { label: "Revenus consultations", value: formatPrice(data.revenueConsultation), icon: "medkit-outline" as const, tint: colors.secondary },
    { label: "Consultations payées", value: String(data.paidConsultationCount), icon: "checkmark-circle-outline" as const, tint: colors.primary },
  ];

  return (
    <Screen>
      <AdminHeader title={TITLE} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.grid}>
          {SUMMARY.map((s) => (
            <Card key={s.label} style={styles.statCard}>
              <View style={[styles.icon, { backgroundColor: s.tint + "22" }]}>
                <Ionicons name={s.icon} size={20} color={s.tint} />
              </View>
              <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>{s.value}</Text>
              <Text style={styles.label}>{s.label}</Text>
            </Card>
          ))}
        </View>

        <View style={styles.failRow}>
          <Ionicons name="information-circle-outline" size={15} color={colors.textMuted} />
          <Text style={styles.failText}>Paiement simulé — toujours réussi, aucun échec.</Text>
        </View>

        <Text style={[typography.h3, styles.sectionTitle]}>Suivi des rendez-vous</Text>
        <SegmentedControl items={FILTERS} value={filter} onChange={(k) => setFilter(k as Filter)} />
        {appts.length === 0 ? (
          <EmptyState icon="calendar-outline" title="Aucun rendez-vous" message="Aucun rendez-vous ne correspond à ce filtre." />
        ) : (
          appts.map((a) => <AdminAppointmentCard key={a.id} a={a} />)
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statCard: { width: "47.5%", gap: spacing.xs, alignItems: "flex-start" },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  value: { fontSize: 22, fontFamily: typography.h1.fontFamily, fontWeight: "700", color: colors.text, marginTop: spacing.xs },
  label: { ...typography.caption, color: colors.textMuted },
  failRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
  failText: { ...typography.caption, color: colors.textMuted, flex: 1 },
  sectionTitle: { marginTop: spacing.md },
});
