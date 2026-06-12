import { useEffect, useState, useCallback } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
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
  delivering: "Expédiée",
  completed: "Livrée",
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

const PAYMENT_LABELS: Record<string, string> = {
  orange_money: "Orange Money",
  mtn: "MTN Money",
  cod: "Paiement à la livraison",
  whatsapp: "WhatsApp",
};

// Étapes de progression (cancelled exclu — état distinct).
const STEPS: { key: OrderStatus; label: string }[] = [
  { key: "pending", label: "En attente" },
  { key: "confirmed", label: "Confirmée" },
  { key: "preparing", label: "En préparation" },
  { key: "delivering", label: "Expédiée" },
  { key: "completed", label: "Livrée" },
];

// Suivi visuel étape par étape (stepper horizontal). Annulée = état distinct.
function OrderTimeline({ status }: { status: OrderStatus }) {
  if (status === "cancelled") {
    return (
      <View style={styles.cancelledRow}>
        <Ionicons name="close-circle" size={18} color={colors.danger} />
        <Text style={styles.cancelledText}>Commande annulée</Text>
      </View>
    );
  }
  const currentIndex = STEPS.findIndex((s) => s.key === status);
  return (
    <View style={styles.timeline}>
      <View style={styles.stepper}>
        {STEPS.map((s, i) => {
          const reached = i <= currentIndex;
          const done = i < currentIndex;
          const current = i === currentIndex;
          return (
            <View key={s.key} style={[styles.segment, i > 0 && styles.segmentGrow]}>
              {i > 0 ? <View style={[styles.line, i <= currentIndex ? styles.lineDone : styles.lineTodo]} /> : null}
              <View style={[styles.node, reached && styles.nodeReached, current && styles.nodeCurrent]}>
                {done ? <Ionicons name="checkmark" size={12} color={colors.white} /> : null}
              </View>
            </View>
          );
        })}
      </View>
      <Text style={styles.currentLabel}>
        Étape actuelle : <Text style={styles.currentLabelStrong}>{STEPS[currentIndex]?.label ?? "—"}</Text>
      </Text>
    </View>
  );
}

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
            const count = itemCount(o.items);
            return (
              <Card key={o.id} style={styles.orderCard}>
                <View style={styles.orderHead}>
                  <Text style={styles.date}>{formatDate(o.created_at)}</Text>
                  <Text style={[styles.badge, { backgroundColor: STATUS_COLORS[o.status] }]}>
                    {STATUS_LABELS[o.status]}
                  </Text>
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
  cancelledRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: "#FFF1F4", paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.md },
  cancelledText: { ...typography.caption, color: colors.danger, fontWeight: "700" },
});
