import { useEffect, useState, useCallback } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Loading } from "@/components/Loading";
import { AdminHeader } from "@/components/AdminHeader";
import { adminService, type DashboardStats } from "@/lib/admin-service";
import { formatPrice } from "@/lib/marketplace-service";
import { colors, radius, spacing, typography } from "@/theme";

type StatCard = { key: keyof DashboardStats; label: string; icon: keyof typeof Ionicons.glyphMap; tint: string };

// Cartes secondaires (grille 2 colonnes).
const CARDS: StatCard[] = [
  { key: "ordersPending", label: "Commandes en attente", icon: "hourglass-outline", tint: colors.accent },
  { key: "ordersThisMonth", label: "Commandes ce mois", icon: "receipt-outline", tint: colors.primary },
  { key: "outOfStock", label: "En rupture", icon: "alert-circle-outline", tint: colors.danger },
  { key: "users", label: "Utilisateurs", icon: "people-outline", tint: colors.primary },
  { key: "doctors", label: "Médecins", icon: "medkit-outline", tint: colors.secondary },
  { key: "appointments", label: "Rendez-vous", icon: "calendar-outline", tint: colors.primary },
  { key: "posts", label: "Publications", icon: "chatbubbles-outline", tint: colors.secondary },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await adminService.getDashboardStats());
    } catch {
      setStats(null);
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

  if (loading && !stats) return <Loading />;

  return (
    <Screen>
      <AdminHeader title="Tableau de bord" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Revenus ce mois — carte mise en avant */}
        <Card style={styles.revenueCard}>
          <View style={styles.revenueTop}>
            <View style={[styles.icon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="cash-outline" size={22} color={colors.primaryDark} />
            </View>
            <Text style={styles.revenueLabel}>Revenus ce mois</Text>
          </View>
          <Text style={styles.revenueValue}>{formatPrice(stats?.revenueThisMonth ?? 0)}</Text>
        </Card>

        <View style={styles.grid}>
          {CARDS.map((c) => (
            <Card key={c.key} style={styles.statCard}>
              <View style={[styles.icon, { backgroundColor: c.tint + "22" }]}>
                <Ionicons name={c.icon} size={20} color={c.tint} />
              </View>
              <Text style={styles.value}>{stats ? stats[c.key] : 0}</Text>
              <Text style={styles.label}>{c.label}</Text>
            </Card>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  revenueCard: { gap: spacing.sm, backgroundColor: colors.primaryLight, borderColor: colors.primary },
  revenueTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  revenueLabel: { ...typography.name, color: colors.primaryDark },
  revenueValue: { fontSize: 30, fontFamily: typography.h1.fontFamily, fontWeight: "700", color: colors.primaryDark },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statCard: { width: "47.5%", gap: spacing.xs, alignItems: "flex-start" },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  value: { fontSize: 28, fontFamily: typography.h1.fontFamily, fontWeight: "700", color: colors.text, marginTop: spacing.xs },
  label: { ...typography.caption, color: colors.textMuted },
});
