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
import { adminService, type SubscriptionsSummary, type AdminAppointmentRow } from "@/lib/admin-service";
import { formatPrice } from "@/lib/marketplace-service";
import { PREMIUM_ENABLED } from "@/lib/app-config";
import type { AppointmentStatus } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

// Écran repurposé : « Consultations & paiements » quand le Premium est retiré
// (PREMIUM_ENABLED=false) ; redevient « Abonnements & Paiements » si réactivé.
const TITLE = PREMIUM_ENABLED ? "Abonnements & Paiements" : "Consultations & paiements";
const APPT_PAGE = 30;

type Filter = "all" | AppointmentStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "confirmed", label: "Confirmé" },
  { key: "pending", label: "En attente" },
  { key: "completed", label: "Terminé" },
  { key: "cancelled", label: "Annulé" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}
function formatPeriod(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const f = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return `${f(start)} → ${f(end)}`;
}

export default function AdminSubscriptions() {
  const [data, setData] = useState<SubscriptionsSummary | null>(null);
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
      const summary = await adminService.getSubscriptionsAdmin();
      setData(summary);
      // Suivi des RDV uniquement dans le mode « Consultations » (Premium retiré).
      if (!PREMIUM_ENABLED) {
        const list = await adminService.getAppointmentsAdmin({
          status: filterRef.current === "all" ? null : filterRef.current,
          limit: APPT_PAGE,
          offset: 0,
        });
        setAppts(list);
      }
    } catch {
      setData(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Recharge au montage et au changement de filtre (mode consultations).
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

  // Indicateurs : axés consultations (Premium retiré) ou abonnements (Premium actif).
  const SUMMARY = PREMIUM_ENABLED
    ? [
        { label: "Abonnés actifs", value: String(data.activeCount), icon: "star" as const, tint: colors.accent },
        { label: "Abonnements expirés", value: String(data.expiredCount), icon: "time-outline" as const, tint: colors.textMuted },
        { label: "Revenus Premium", value: formatPrice(data.revenuePremium), icon: "card-outline" as const, tint: colors.primary },
        { label: "Revenus consultations", value: formatPrice(data.revenueConsultation), icon: "medkit-outline" as const, tint: colors.secondary },
      ]
    : [
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

        {PREMIUM_ENABLED ? (
          <>
            <Text style={[typography.h3, styles.sectionTitle]}>Paiements récents</Text>
            {data.payments.length === 0 ? (
              <EmptyState icon="card-outline" title="Aucun paiement" message="Aucun paiement d'abonnement enregistré pour le moment." />
            ) : (
              data.payments.map((p) => {
                const period = formatPeriod(p.period_start, p.period_end);
                return (
                  <Card key={p.id} style={styles.payCard}>
                    <View style={styles.payTop}>
                      <Text style={styles.payName} numberOfLines={1}>{p.userName ?? "Utilisatrice"}</Text>
                      <Text style={styles.payAmount}>{formatPrice(p.amount)}</Text>
                    </View>
                    <View style={styles.payMeta}>
                      {p.plan ? <Text style={styles.payPlan}>{p.plan}</Text> : null}
                      {p.method ? <Text style={styles.payMethod}>{p.method}</Text> : null}
                      <Text style={styles.payDate}>{formatDate(p.paid_at)}</Text>
                    </View>
                    {period ? <Text style={styles.payPeriod}>Période : {period}</Text> : null}
                  </Card>
                );
              })
            )}
          </>
        ) : (
          <>
            <Text style={[typography.h3, styles.sectionTitle]}>Suivi des rendez-vous</Text>
            <SegmentedControl items={FILTERS} value={filter} onChange={(k) => setFilter(k as Filter)} />
            {appts.length === 0 ? (
              <EmptyState icon="calendar-outline" title="Aucun rendez-vous" message="Aucun rendez-vous ne correspond à ce filtre." />
            ) : (
              appts.map((a) => <AdminAppointmentCard key={a.id} a={a} />)
            )}
          </>
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
  payCard: { gap: spacing.xs },
  payTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  payName: { ...typography.name, flex: 1 },
  payAmount: { ...typography.name, color: colors.primaryDark },
  payMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  payPlan: { ...typography.caption, color: colors.white, backgroundColor: colors.primary, paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: radius.pill, overflow: "hidden", fontWeight: "700" },
  payMethod: { ...typography.caption, color: colors.textMuted },
  payDate: { ...typography.caption, color: colors.textMuted, marginLeft: "auto" },
  payPeriod: { ...typography.caption, color: colors.textMuted },
});
