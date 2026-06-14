import { useEffect, useState, useCallback } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Loading } from "@/components/Loading";
import { AdminHeader } from "@/components/AdminHeader";
import { BarChart } from "@/components/BarChart";
import {
  adminService,
  type MonthlySeries,
  type RevenueStats,
  type AdminCounts,
} from "@/lib/admin-service";
import { formatPrice } from "@/lib/marketplace-service";
import { colors, radius, spacing, typography } from "@/theme";

function StatCard({ icon, label, value, tint, wide }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; tint: string; wide?: boolean }) {
  return (
    <Card style={[styles.statCard, wide && styles.statCardWide]}>
      <View style={[styles.statIcon, { backgroundColor: tint + "22" }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

export default function AdminStats() {
  const [series, setSeries] = useState<MonthlySeries | null>(null);
  const [revenue, setRevenue] = useState<RevenueStats | null>(null);
  const [counts, setCounts] = useState<AdminCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r, c] = await Promise.all([
        adminService.getMonthlySeries(),
        adminService.getRevenueStats(),
        adminService.getCounts(),
      ]);
      setSeries(s); setRevenue(r); setCounts(c);
    } catch {
      setSeries(null); setRevenue(null); setCounts(null);
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

  if (loading && !series) return <Loading />;

  const sum = (a: number[] | undefined) => (a ?? []).reduce((x, y) => x + y, 0);

  return (
    <Screen>
      <AdminHeader title="Statistiques" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Revenu total — mis en avant */}
        <Card style={styles.totalCard}>
          <View style={styles.totalTop}>
            <View style={[styles.statIcon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="cash-outline" size={22} color={colors.primaryDark} />
            </View>
            <Text style={styles.totalLabel}>Revenu total</Text>
          </View>
          <Text style={styles.totalValue}>{formatPrice(revenue?.totalRevenue ?? 0)}</Text>
        </Card>

        {/* Détail revenus + synthèse */}
        <View style={styles.grid}>
          <StatCard icon="bag-handle-outline" label="Revenus marketplace" value={formatPrice(revenue?.marketplaceRevenue ?? 0)} tint={colors.primary} />
          <StatCard icon="medkit-outline" label="Revenus consultations" value={formatPrice(revenue?.consultationRevenue ?? 0)} tint={colors.secondary} />
          <StatCard icon="star-outline" label="Abonnées Premium" value={String(revenue?.premiumCount ?? 0)} tint={colors.accent} />
          <StatCard icon="people-outline" label="Utilisatrices" value={String(counts?.users ?? 0)} tint={colors.primary} />
          <StatCard icon="receipt-outline" label="Commandes totales" value={String(counts?.orders ?? 0)} tint={colors.primary} />
          <StatCard icon="calendar-outline" label="Consultations totales" value={String(counts?.appointments ?? 0)} tint={colors.secondary} />
        </View>

        {/* Tendances mensuelles */}
        <Card style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={typography.h3}>Inscriptions</Text>
            <Text style={styles.total}>{sum(series?.signups)} sur 6 mois</Text>
          </View>
          {series && <BarChart labels={series.months} values={series.signups} tint={colors.primary} />}
        </Card>

        <Card style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={typography.h3}>Commandes</Text>
            <Text style={styles.total}>{sum(series?.orders)} sur 6 mois</Text>
          </View>
          {series && <BarChart labels={series.months} values={series.orders} tint={colors.accent} />}
        </Card>

        <Card style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={typography.h3}>Consultations</Text>
            <Text style={styles.total}>{sum(series?.appointments)} sur 6 mois</Text>
          </View>
          {series && <BarChart labels={series.months} values={series.appointments} tint={colors.secondary} />}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  totalCard: { gap: spacing.sm, backgroundColor: colors.primaryLight, borderColor: colors.primary },
  totalTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  totalLabel: { ...typography.name, color: colors.primaryDark },
  totalValue: { fontSize: 28, fontFamily: typography.h1.fontFamily, fontWeight: "700", color: colors.primaryDark },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statCard: { width: "47.5%", gap: spacing.xs, alignItems: "flex-start" },
  statCardWide: { width: "100%" },
  statIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 18, fontFamily: typography.h1.fontFamily, fontWeight: "700", color: colors.text, marginTop: spacing.xs },
  statLabel: { ...typography.caption, color: colors.textMuted },
  card: { gap: spacing.md },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  total: { ...typography.caption, color: colors.textMuted },
  chart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 160, gap: spacing.xs },
  barCol: { flex: 1, alignItems: "center", gap: spacing.xs },
  barValue: { ...typography.caption, color: colors.text, fontWeight: "600" },
  barTrack: { width: "70%", flex: 1, backgroundColor: colors.surface, borderRadius: radius.sm, justifyContent: "flex-end", overflow: "hidden" },
  barFill: { width: "100%", borderRadius: radius.sm, minHeight: 3 },
  barLabel: { ...typography.caption, color: colors.textMuted, textTransform: "capitalize" },
});
