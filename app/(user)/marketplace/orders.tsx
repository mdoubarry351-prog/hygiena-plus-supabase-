import { useEffect, useState, useCallback } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonList } from "@/components/Skeleton";
import { OrderTimeline } from "@/components/OrderTimeline";
import { useAuth } from "@/providers/AuthProvider";
import { marketplaceService, formatPrice } from "@/lib/marketplace-service";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, PAYMENT_LABELS, orderItemCount, formatOrderDate } from "@/lib/order-display";
import type { MarketplaceOrder } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

export default function Orders() {
  const { session } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    try {
      const data = await marketplaceService.getOrders(session.user.id);
      setOrders(data);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [session?.user]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading && orders.length === 0) return <SkeletonList variant="order" />;

  return (
    <Screen>
      <ScreenHeader title="Mes commandes" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >

        {orders.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="Aucune commande"
            message="Vos commandes apparaîtront ici après votre premier achat."
          />
        ) : (
          orders.map((o) => {
            const count = orderItemCount(o.items);
            return (
              <Card key={o.id} onPress={() => router.push({ pathname: "/(user)/marketplace/order", params: { id: o.id } })} accessibilityLabel="Voir la commande" style={styles.orderCard}>
                  <View style={styles.orderHead}>
                    <Text style={styles.date}>{formatOrderDate(o.created_at)}</Text>
                    <Badge label={ORDER_STATUS_LABELS[o.status]} color={ORDER_STATUS_COLORS[o.status]} />
                  </View>
                  <OrderTimeline status={o.status} />
                  {o.payment_method ? (
                    <View style={styles.payRow}>
                      <Ionicons name={o.is_paid ? "checkmark-circle" : "cash-outline"} size={14} color={o.is_paid ? colors.success : colors.textMuted} />
                      <Text style={styles.payText}>
                        {PAYMENT_LABELS[o.payment_method] ?? o.payment_method} · {o.is_paid ? "Payé" : "À la livraison"}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.orderFoot}>
                    <Text style={styles.count}>{count} article{count > 1 ? "s" : ""}</Text>
                    <Text style={styles.total}>{formatPrice(o.total_amount)}</Text>
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
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  empty: { alignItems: "center", gap: spacing.sm },
  muted: { color: colors.textMuted, textAlign: "center" },
  orderCard: { gap: spacing.sm },
  orderHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  date: { ...typography.body, fontWeight: "600", flex: 1 },
  badge: {
    ...typography.caption, color: colors.white, fontWeight: "700",
    paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, overflow: "hidden",
  },
  orderFoot: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm,
  },
  count: { ...typography.body, color: colors.textMuted },
  total: { ...typography.h3, color: colors.primary },
  payRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  payText: { ...typography.caption, color: colors.textMuted },
  // Timeline / stepper
  timeline: { gap: spacing.xs },
  stepper: { flexDirection: "row", alignItems: "center" },
  segment: { flexDirection: "row", alignItems: "center" },
  segmentGrow: { flex: 1 },
  line: { flex: 1, height: 2, marginHorizontal: 4, borderRadius: 1 },
  lineDone: { backgroundColor: colors.primary },
  lineTodo: { backgroundColor: colors.border },
  node: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.border, alignItems: "center", justifyContent: "center" },
  nodeReached: { backgroundColor: colors.primary },
  nodeCurrent: { width: 26, height: 26, borderRadius: 13, borderWidth: 3, borderColor: colors.primaryLight },
  currentLabel: { ...typography.caption, color: colors.textMuted },
  currentLabelStrong: { color: colors.primaryDark, fontWeight: "700" },
  cancelledRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.dangerSoft, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.md },
  cancelledText: { ...typography.caption, color: colors.danger, fontWeight: "700" },
});
