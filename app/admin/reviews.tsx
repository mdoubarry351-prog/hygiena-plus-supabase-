import { useEffect, useRef, useState, useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/providers/ToastProvider";
import { Loading } from "@/components/Loading";
import { AdminHeader } from "@/components/AdminHeader";
import { EmptyState } from "@/components/EmptyState";
import { StarRating } from "@/components/StarRating";
import { LoadMoreFooter, isNearBottom } from "@/components/LoadMoreFooter";
import { useAuth } from "@/providers/AuthProvider";
import { adminService, type ProductReviewRow, type DoctorReviewRow } from "@/lib/admin-service";
import { colors, radius, spacing, typography } from "@/theme";

type Tab = "product" | "doctor";
type ReviewRow = ProductReviewRow | DoctorReviewRow;

const PAGE = 20;

export default function AdminReviews() {
  const { session } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("product");
  const [items, setItems] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);

  const fetchPage = useCallback(
    (t: Tab, offset: number) =>
      t === "product"
        ? adminService.getProductReviewsAdmin(PAGE, offset)
        : adminService.getDoctorReviewsAdmin(PAGE, offset),
    []
  );

  const load = useCallback(async (t: Tab) => {
    setLoading(true);
    try {
      const data = await fetchPage(t, 0);
      setItems(data);
      offsetRef.current = PAGE;
      setHasMore(data.length === PAGE);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => { load(tab); }, [load, tab]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchPage(tab, offsetRef.current);
      setItems((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...data.filter((r) => !seen.has(r.id))];
      });
      offsetRef.current += PAGE;
      setHasMore(data.length === PAGE);
    } catch {
      // garde l'état
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, fetchPage, tab]);

  async function confirmDelete(review: ReviewRow) {
    if (!session?.user) return;
    const ok = await confirm({ title: "Supprimer cet avis ?", message: "Cette action est définitive.", confirmLabel: "Supprimer", danger: true });
    if (!ok) return;
    try {
      if (tab === "product") await adminService.deleteProductReview(session.user.id, review.id);
      else await adminService.deleteDoctorReview(session.user.id, review.id);
      setItems((prev) => prev.filter((r) => r.id !== review.id));
      toast.success("Avis supprimé.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suppression échouée");
    }
  }

  function switchTab(t: Tab) {
    if (t === tab) return;
    setItems([]);
    setHasMore(false);
    offsetRef.current = 0;
    setTab(t);
  }

  return (
    <Screen>
      <AdminHeader title="Avis" />

      {/* Onglets */}
      <View style={styles.tabs}>
        {(["product", "doctor"] as Tab[]).map((t) => {
          const active = tab === t;
          return (
            <Pressable key={t} onPress={() => switchTab(t)} style={[styles.tab, active && styles.tabActive]}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t === "product" ? "Produits" : "Médecins"}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading && items.length === 0 ? (
        <Loading />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => { if (isNearBottom(e)) loadMore(); }}
          scrollEventThrottle={400}
        >
          {items.length === 0 ? (
            <EmptyState icon="star-outline" title="Aucun avis" />
          ) : (
            <>
              {items.map((r) => (
                <Card key={r.id} style={styles.card}>
                  <View style={styles.head}>
                    <Text style={styles.target} numberOfLines={1}>{r.targetName ?? "—"}</Text>
                    <Pressable onPress={() => confirmDelete(r)} hitSlop={8} style={styles.deleteBtn} accessibilityRole="button" accessibilityLabel="Supprimer l'avis">
                      <Ionicons name="trash-outline" size={20} color={colors.danger} />
                    </Pressable>
                  </View>
                  <StarRating value={r.rating} size={15} compact />
                  {r.comment ? <Text style={styles.comment} numberOfLines={4}>{r.comment}</Text> : null}
                  <Text style={styles.meta}>
                    {r.authorName ?? "Utilisatrice"} · {new Date(r.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                  </Text>
                </Card>
              ))}
              <LoadMoreFooter hasMore={hasMore} loadingMore={loadingMore} onLoadMore={loadMore} />
            </>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: spacing.xs, backgroundColor: colors.surface, borderRadius: radius.md, padding: 4, marginTop: spacing.sm },
  tab: { flex: 1, alignItems: "center", paddingVertical: spacing.sm, borderRadius: radius.sm },
  tabActive: { backgroundColor: colors.primary },
  tabText: { ...typography.caption, fontWeight: "700", color: colors.textMuted },
  tabTextActive: { color: colors.white },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  card: { gap: spacing.xs },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  target: { ...typography.name, flex: 1 },
  deleteBtn: { padding: spacing.xs },
  comment: { ...typography.body, color: colors.text, lineHeight: 21 },
  meta: { ...typography.caption, color: colors.textMuted },
});
