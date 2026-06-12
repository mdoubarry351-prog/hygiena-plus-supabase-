import { useEffect, useRef, useState, useCallback } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Loading } from "@/components/Loading";
import { AdminHeader } from "@/components/AdminHeader";
import { EmptyState } from "@/components/EmptyState";
import { ExportButton } from "@/components/ExportButton";
import { LoadMoreFooter, isNearBottom } from "@/components/LoadMoreFooter";
import { useAuth } from "@/providers/AuthProvider";
import { adminService } from "@/lib/admin-service";
import { exportCsv } from "@/lib/csv-export";
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const offsetRef = useRef(0);
  const PAGE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminService.getOrdersPage(PAGE, 0);
      setOrders(data);
      offsetRef.current = PAGE;
      setHasMore(data.length === PAGE);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await adminService.getOrdersPage(PAGE, offsetRef.current);
      setOrders((prev) => {
        const seen = new Set(prev.map((o) => o.id));
        return [...prev, ...data.filter((o) => !seen.has(o.id))];
      });
      offsetRef.current += PAGE;
      setHasMore(data.length === PAGE);
    } catch {
      // garde l'état
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore]);

  useEffect(() => { load(); }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleExport() {
    try {
      const rows = orders.map((o) => ({
        numero: o.id.slice(0, 8),
        cliente: o.phone,
        articles: String(itemCount(o.items)),
        montant: formatPrice(o.total_amount),
        statut: STATUS_LABELS[o.status],
        date: new Date(o.created_at).toLocaleDateString("fr-FR"),
      }));
      await exportCsv("commandes", rows, [
        { key: "numero", label: "N°" },
        { key: "cliente", label: "Cliente (téléphone)" },
        { key: "articles", label: "Articles" },
        { key: "montant", label: "Montant" },
        { key: "statut", label: "Statut" },
        { key: "date", label: "Date" },
      ]);
    } catch (e) {
      Alert.alert("Export impossible", e instanceof Error ? e.message : "Réessayez.");
    }
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
      <AdminHeader title="Commandes" right={<ExportButton onPress={handleExport} />} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => { if (isNearBottom(e)) loadMore(); }}
        scrollEventThrottle={400}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {orders.length === 0 ? (
          <EmptyState icon="receipt-outline" title="Aucune commande" />
        ) : (
          <>
            {orders.map((o) => {
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
            })}
            <LoadMoreFooter hasMore={hasMore} loadingMore={loadingMore} onLoadMore={loadMore} />
          </>
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
