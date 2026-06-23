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
import { orderStepInfo } from "@/components/OrderTimeline";
import { FadeInView } from "@/components/FadeInView";
import { useAuth } from "@/providers/AuthProvider";
import { marketplaceService, formatPrice } from "@/lib/marketplace-service";
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE, orderItemCount, formatOrderDate } from "@/lib/order-display";
import type { MarketplaceOrder } from "@/lib/database.types";
import { colors, spacing, typography } from "@/theme";

const STEP = 55; // pas de l'apparition échelonnée

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
            message="Tes commandes apparaîtront ici après ton premier achat."
          />
        ) : (
          orders.map((o, i) => {
            const count = orderItemCount(o.items);
            const shortId = o.id.slice(0, 8).toUpperCase();
            const cancelled = o.status === "cancelled";
            const step = orderStepInfo(o.status, o.delivery_mode);
            return (
              <FadeInView key={o.id} fill={false} delay={Math.min(i, 6) * STEP}>
              <Card onPress={() => router.push({ pathname: "/(user)/marketplace/order", params: { id: o.id } })} haptic accessibilityLabel={`Commande ${shortId}`} style={styles.orderCard}>
                  <View style={styles.orderHead}>
                    <View style={styles.headLeft}>
                      <Text style={styles.orderId}>#{shortId}</Text>
                      <Text style={styles.date}>{formatOrderDate(o.created_at)}</Text>
                    </View>
                    <Badge label={ORDER_STATUS_LABELS[o.status]} tone={ORDER_STATUS_TONE[o.status]} soft />
                  </View>
                  {/* Ligne d'état courant compacte (le suivi détaillé est sur la fiche). */}
                  <View style={styles.statusLine}>
                    <Ionicons name={step.icon} size={15} color={cancelled ? colors.danger : colors.primary} />
                    <Text style={[styles.statusText, cancelled && styles.statusCancelled]} numberOfLines={1}>{step.label}</Text>
                  </View>
                  <View style={styles.orderFoot}>
                    <Text style={styles.count}>{count} article{count > 1 ? "s" : ""}</Text>
                    <Text style={styles.total}>{formatPrice(o.total_amount)}</Text>
                  </View>
              </Card>
              </FadeInView>
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
  orderHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  headLeft: { flex: 1, gap: 2 },
  orderId: { ...typography.name },
  date: { ...typography.caption, color: colors.textMuted },
  // Ligne d'état courant
  statusLine: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  statusText: { ...typography.caption, color: colors.primaryDark, fontWeight: "700", flex: 1 },
  statusCancelled: { color: colors.danger },
  orderFoot: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm,
  },
  count: { ...typography.body, color: colors.textMuted },
  total: { ...typography.h3, color: colors.primary },
});
