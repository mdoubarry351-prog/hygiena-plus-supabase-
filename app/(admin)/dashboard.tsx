import { useEffect, useState, useCallback } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Loading } from "@/components/Loading";
import { AdminHeader } from "@/components/AdminHeader";
import { adminService, type AdminCounts } from "@/lib/admin-service";
import { colors, radius, spacing, typography } from "@/theme";

const CARDS: { key: keyof AdminCounts; label: string; icon: keyof typeof Ionicons.glyphMap; tint: string }[] = [
  { key: "users", label: "Utilisateurs", icon: "people", tint: colors.primary },
  { key: "doctors", label: "Médecins", icon: "medkit", tint: colors.secondary },
  { key: "orders", label: "Commandes", icon: "receipt", tint: colors.accent },
  { key: "posts", label: "Publications", icon: "chatbubbles", tint: colors.secondary },
  { key: "appointments", label: "Rendez-vous", icon: "calendar", tint: colors.primary },
];

export default function AdminDashboard() {
  const [counts, setCounts] = useState<AdminCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCounts(await adminService.getCounts());
    } catch {
      setCounts(null);
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

  if (loading && !counts) return <Loading />;

  return (
    <Screen>
      <AdminHeader title="Tableau de bord" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.grid}>
          {CARDS.map((c) => (
            <Card key={c.key} style={styles.statCard}>
              <View style={[styles.icon, { backgroundColor: c.tint + "22" }]}>
                <Ionicons name={c.icon} size={20} color={c.tint} />
              </View>
              <Text style={styles.value}>{counts ? counts[c.key] : 0}</Text>
              <Text style={styles.label}>{c.label}</Text>
            </Card>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statCard: { width: "47.5%", gap: spacing.xs, alignItems: "flex-start" },
  icon: { width: 36, height: 36, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  value: { fontSize: 28, fontWeight: "700", color: colors.text },
  label: { ...typography.caption, color: colors.textMuted },
});
