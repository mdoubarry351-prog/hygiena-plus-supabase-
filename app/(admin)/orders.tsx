import { useEffect, useState, useCallback } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Loading } from "@/components/Loading";
import { AdminHeader } from "@/components/AdminHeader";
import { useAuth } from "@/providers/AuthProvider";
import { adminService } from "@/lib/admin-service";
import { formatPrice, type OrderItem } from "@/lib/marketplace-service";
import type { MarketplaceOrder, OrderStatus } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  preparing: "En préparation",
  delivering: "En livraison",
  completed: "Terminée",
  cancelled: "Annulée",
};
const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: colors.accent,
  confirmed: colors.secondary,
  preparing: colors.secondary,
  delivering: colors.primary,
  completed: colors.success,
  cancelled: colors.danger,
};
const STATUSES = Object.keys(STATUS_LABELS) as OrderStatus[];

function itemCount(items: MarketplaceOrder["items"]): number {
  if (!Array.isArray(items)) return 0;
  return (items as unknown as OrderItem[]).reduce((s, it) => s + (it?.quantity ?? 0), 0);
}

export default function AdminOrders() {
  const { session } = useAuth();
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOrders(await adminService.getOrders());
    } catch {
      setOrders([]);
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

  function changeStatus(order: MarketplaceOrder) {
    if (!session?.user) return;
    Alert.alert("Changer le statut", `Commande du ${new Date(order.created_at).toLocaleDateString("fr-FR")}`,
      [
        ...STATUSES.filter((s) => s !== order.status).map((s) => ({
          text: STATUS_LABELS[s],
          onPress: async () => {
            setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: s } : o)));
            try {
              await adminService.updateOrderStatus(session.user.id, order.id, s);
            } catch (e) {
              Alert.alert("Erreur", e instanceof Error ? e.message : "Action échouée");
              await load();
            }
          },
        })),
        { text: "Annuler", style: "cancel" as const },
      ]
    );
  }

  if (loading && orders.length === 0) return <Loading />;

  return (
    <Screen>
      <AdminHeader title="Commandes" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {orders.length === 0 ? (
          <Card style={styles.empty}><Text style={[typography.body, styles.muted]}>Aucune commande.</Text></Card>
        ) : (
          orders.map((o) => {
            const count = itemCount(o.items);
            return (
              <Card key={o.id} style={styles.card}>
                <View style={styles.head}>
                  <Text style={styles.date}>{new Date(o.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</Text>
                  <Text style={[styles.badge, { backgroundColor: STATUS_COLORS[o.status] }]}>{STATUS_LABELS[o.status]}</Text>
                </View>
                <Text style={styles.meta}>{o.phone} · {o.delivery_mode === "delivery" ? "Livraison" : "Retrait"}{o.neighborhood ? ` · ${o.neighborhood}` : ""}</Text>
                <View style={styles.foot}>
                  <Text style={styles.count}>{count} article{count > 1 ? "s" : ""} · {formatPrice(o.total_amount)}</Text>
                  <Pressable onPress={() => changeStatus(o)} style={styles.statusBtn}>
                    <Ionicons name="swap-horizontal" size={16} color={colors.primary} />
                    <Text style={styles.statusBtnText}>Statut</Text>
                  </Pressable>
                </View>
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
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  date: { ...typography.body, fontWeight: "600", flex: 1 },
  badge: { ...typography.caption, color: colors.white, fontWeight: "700", paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, overflow: "hidden" },
  meta: { ...typography.caption, color: colors.textMuted },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  count: { ...typography.body, color: colors.text, flex: 1 },
  statusBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary },
  statusBtnText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
});
