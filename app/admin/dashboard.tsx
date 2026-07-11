import { useEffect, useState, useCallback } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { AdminHeader } from "@/components/AdminHeader";
import { adminService, type DashboardRpc } from "@/lib/admin-service";
import { formatPrice } from "@/lib/marketplace-service";
import { colors, radius, spacing, typography } from "@/theme";

type CardDef = { key: keyof DashboardRpc; label: string; icon: keyof typeof Ionicons.glyphMap; tint: string; href: Href; money?: boolean };

const CARDS: CardDef[] = [
  { key: "usersTotal", label: "Utilisateurs inscrits", icon: "people-outline", tint: colors.primary, href: "/admin/users" },
  { key: "activeUsers", label: "Utilisateurs actifs", icon: "pulse-outline", tint: colors.secondary, href: "/admin/users" },
  { key: "revenueConsultation", label: "Revenus consultations", icon: "medkit-outline", tint: colors.accent, href: "/admin/subscriptions", money: true },
  { key: "doctorsActive", label: "Médecins actifs", icon: "medkit-outline", tint: colors.secondary, href: "/admin/doctors" },
  { key: "appointmentsToday", label: "RDV du jour", icon: "calendar-outline", tint: colors.primary, href: "/admin/appointments" },
  { key: "ordersTotal", label: "Commandes Marketplace", icon: "receipt-outline", tint: colors.primary, href: "/admin/orders" },
  { key: "postsCount", label: "Publications", icon: "chatbubbles-outline", tint: colors.secondary, href: "/admin/community" },
  { key: "reportsPending", label: "Signalements à traiter", icon: "flag-outline", tint: colors.danger, href: "/admin/reports" },
];

// Repli si la RPC échoue : on dérive ce qu'on peut de l'ancien getDashboardStats.
async function fallbackStats(): Promise<DashboardRpc> {
  const s = await adminService.getDashboardStats();
  return {
    ok: true,
    usersTotal: s.users,
    activeUsers: 0,
    doctorsActive: s.doctors,
    appointmentsToday: 0,
    ordersTotal: s.ordersThisMonth,
    ordersPending: s.ordersPending,
    postsCount: s.posts,
    reportsPending: 0,
    revenueMarketplace: s.revenueThisMonth,
    revenueConsultation: 0,
    revenueTotal: s.revenueThisMonth,
  };
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardRpc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setStats(await adminService.getDashboardStatsRpc());
    } catch {
      // RPC indisponible → repli best-effort, sinon erreur.
      try {
        setStats(await fallbackStats());
      } catch {
        setStats(null);
        setError(true);
      }
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

  if (loading && !stats) {
    return (
      <Screen>
        <AdminHeader title="Tableau de bord" />
        <View style={styles.content}>
          <Skeleton height={92} radius={radius.lg} />
          <View style={styles.grid}>
            {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} width="47.5%" height={96} radius={radius.lg} />)}
          </View>
        </View>
      </Screen>
    );
  }

  if (error || !stats) {
    return (
      <Screen>
        <AdminHeader title="Tableau de bord" />
        <EmptyState
          icon="cloud-offline-outline"
          title="Statistiques indisponibles"
          message="Impossible de charger les indicateurs pour le moment."
          actionLabel="Réessayer"
          onAction={load}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AdminHeader title="Tableau de bord" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Revenus estimés — carte mise en avant */}
        <Card onPress={() => router.push("/admin/subscriptions")} style={styles.revenueCard}>
          <View style={styles.revenueTop}>
            <View style={[styles.icon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="cash-outline" size={22} color={colors.primaryDark} />
            </View>
            <Text style={styles.revenueLabel}>Revenus estimés</Text>
          </View>
          <Text style={styles.revenueValue}>{formatPrice(stats.revenueTotal)}</Text>
          <Text style={styles.revenueBreak}>
            Marketplace {formatPrice(stats.revenueMarketplace)} · Consultations {formatPrice(stats.revenueConsultation)}
          </Text>
        </Card>

        <View style={styles.grid}>
          {CARDS.map((c) => (
            <View key={c.key} style={styles.cell}>
              <Card onPress={() => router.push(c.href)} style={styles.statCard}>
                <View style={[styles.icon, { backgroundColor: c.tint + "22" }]}>
                  <Ionicons name={c.icon} size={20} color={c.tint} />
                </View>
                <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>{c.money ? formatPrice(stats[c.key] as number) : stats[c.key]}</Text>
                <Text style={styles.label} numberOfLines={2}>{c.label}</Text>
                {c.key === "ordersTotal" && stats.ordersPending > 0 ? (
                  <Text style={styles.sub} numberOfLines={1}>{stats.ordersPending} en attente</Text>
                ) : null}
              </Card>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  revenueCard: { gap: spacing.xs, backgroundColor: colors.primaryLight, borderColor: colors.primary },
  revenueTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  revenueLabel: { ...typography.name, color: colors.primaryDark },
  revenueValue: { fontSize: 30, fontFamily: typography.h1.fontFamily, fontWeight: "700", color: colors.primaryDark },
  revenueBreak: { ...typography.caption, color: colors.primaryDark },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  // La largeur est portée par la cellule (et non par la Card cliquable, dont le
  // wrapper PressableScale ne résout pas les % de largeur — d'où l'ancien bug).
  cell: { width: "48%", flexGrow: 1, minWidth: 150 },
  statCard: { width: "100%", gap: spacing.xs, alignItems: "flex-start" },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  value: { fontSize: 28, fontFamily: typography.h1.fontFamily, fontWeight: "700", color: colors.text, marginTop: spacing.xs, letterSpacing: 0 },
  label: { ...typography.caption, color: colors.textMuted, letterSpacing: 0 },
  sub: { ...typography.caption, color: colors.accent, fontWeight: "700" },
});
