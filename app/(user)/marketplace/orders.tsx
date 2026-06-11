import { useEffect, useState, useCallback } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Loading } from "@/components/Loading";
import { useAuth } from "@/providers/AuthProvider";
import { marketplaceService, formatPrice, type OrderItem } from "@/lib/marketplace-service";
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

function itemCount(items: MarketplaceOrder["items"]): number {
  if (!Array.isArray(items)) return 0;
  return (items as unknown as OrderItem[]).reduce((s, it) => s + (it?.quantity ?? 0), 0);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Orders() {
  const { session } = useAuth();
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

  if (loading && orders.length === 0) return <Loading />;

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Text style={typography.h2}>Mes commandes</Text>

        {orders.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="Aucune commande"
            message="Vos commandes apparaîtront ici après votre premier achat."
          />
        ) : (
          orders.map((o) => {
            const count = itemCount(o.items);
            return (
              <Card key={o.id} style={styles.orderCard}>
                <View style={styles.orderHead}>
                  <Text style={styles.date}>{formatDate(o.created_at)}</Text>
                  <Text style={[styles.badge, { backgroundColor: STATUS_COLORS[o.status] }]}>
                    {STATUS_LABELS[o.status]}
                  </Text>
                </View>
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
});
