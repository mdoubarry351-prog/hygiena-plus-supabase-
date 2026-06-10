import { useEffect, useState, useCallback } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Loading } from "@/components/Loading";
import { AdminHeader } from "@/components/AdminHeader";
import { adminService, type MonthlySeries } from "@/lib/admin-service";
import { colors, radius, spacing, typography } from "@/theme";

// Histogramme minimaliste (barres en Views, aucune lib de charts).
function BarChart({ labels, values, tint }: { labels: string[]; values: number[]; tint: string }) {
  const max = Math.max(1, ...values);
  return (
    <View style={styles.chart}>
      {values.map((v, i) => (
        <View key={i} style={styles.barCol}>
          <Text style={styles.barValue}>{v}</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { height: `${(v / max) * 100}%`, backgroundColor: tint }]} />
          </View>
          <Text style={styles.barLabel}>{labels[i]}</Text>
        </View>
      ))}
    </View>
  );
}

export default function AdminStats() {
  const [series, setSeries] = useState<MonthlySeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSeries(await adminService.getMonthlySeries());
    } catch {
      setSeries(null);
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

  const totalSignups = series?.signups.reduce((a, b) => a + b, 0) ?? 0;
  const totalOrders = series?.orders.reduce((a, b) => a + b, 0) ?? 0;

  return (
    <Screen>
      <AdminHeader title="Statistiques" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Card style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={typography.h3}>Inscriptions</Text>
            <Text style={styles.total}>{totalSignups} sur 6 mois</Text>
          </View>
          {series && <BarChart labels={series.months} values={series.signups} tint={colors.primary} />}
        </Card>

        <Card style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={typography.h3}>Commandes</Text>
            <Text style={styles.total}>{totalOrders} sur 6 mois</Text>
          </View>
          {series && <BarChart labels={series.months} values={series.orders} tint={colors.accent} />}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
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
