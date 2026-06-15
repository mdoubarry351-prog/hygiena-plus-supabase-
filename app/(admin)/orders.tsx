import { useEffect, useRef, useState, useCallback } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Input } from "@/components/Input";
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
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | OrderStatus>("all");
  const [exporting, setExporting] = useState(false);
  const offsetRef = useRef(0);
  const filtersRef = useRef<{ search: string; status: "all" | OrderStatus }>({ search: "", status: "all" });
  const PAGE = 20;

  // Filtres serveur courants (recherche téléphone + statut).
  const serverFilters = () => ({
    search: filtersRef.current.search || null,
    status: filtersRef.current.status === "all" ? null : filtersRef.current.status,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminService.getOrdersPage(PAGE, 0, serverFilters());
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
      const data = await adminService.getOrdersPage(PAGE, offsetRef.current, serverFilters());
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

  // Recharge serveur (page 0) à chaque changement de recherche/statut, avec debounce.
  useEffect(() => {
    filtersRef.current = { search, status };
    const t = setTimeout(() => { load(); }, 350);
    return () => clearTimeout(t);
  }, [search, status, load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const all = await adminService.getAllOrdersFiltered(serverFilters());
      const rows = all.map((o) => ({
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
    } finally {
      setExporting(false);
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
      <AdminHeader title="Commandes" right={<ExportButton onPress={handleExport} loading={exporting} />} />
      <View style={styles.filters}>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher (téléphone)…"
          autoCapitalize="none"
          keyboardType="phone-pad"
          style={styles.searchInput}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusRow}>
          {(["all", ...STATUSES] as const).map((s) => {
            const active = status === s;
            return (
              <Pressable key={s} onPress={() => setStatus(s)} style={[styles.statusChip, active && styles.statusChipActive]}>
                <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>{s === "all" ? "Toutes" : STATUS_LABELS[s]}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => { if (isNearBottom(e)) loadMore(); }}
        scrollEventThrottle={400}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {orders.length === 0 ? (
          <EmptyState icon="receipt-outline" title={search.trim() || status !== "all" ? "Aucun résultat" : "Aucune commande"} />
        ) : (
          <>
            {orders.map((o) => {
              const count = itemCount(o.items);
              return (
                <Card key={o.id} style={styles.card}>
                  <View style={styles.head}>
                    <Text style={styles.date}>{new Date(o.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</Text>
                    <Badge label={STATUS_LABELS[o.status]} color={STATUS_COLORS[o.status]} />
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
  filters: { paddingTop: spacing.sm, gap: spacing.sm },
  searchInput: { marginBottom: 0 },
  statusRow: { gap: spacing.xs, paddingRight: spacing.md },
  statusChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border },
  statusChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  statusChipText: { ...typography.caption, fontWeight: "700", color: colors.text },
  statusChipTextActive: { color: colors.white },
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
