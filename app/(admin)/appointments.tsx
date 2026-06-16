import { useEffect, useRef, useState, useCallback } from "react";
import { ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Screen } from "@/components/Screen";
import { Loading } from "@/components/Loading";
import { EmptyState } from "@/components/EmptyState";
import { AdminHeader } from "@/components/AdminHeader";
import { SegmentedControl } from "@/components/SegmentedControl";
import { LoadMoreFooter, isNearBottom } from "@/components/LoadMoreFooter";
import { AdminAppointmentCard } from "@/components/AdminAppointmentCard";
import { adminService, type AdminAppointmentRow } from "@/lib/admin-service";
import type { AppointmentStatus } from "@/lib/database.types";
import { colors, spacing } from "@/theme";

const PAGE = 20;

type Filter = "all" | AppointmentStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "confirmed", label: "Confirmé" },
  { key: "pending", label: "En attente" },
  { key: "cancelled", label: "Annulé" },
  { key: "completed", label: "Terminé" },
];

export default function AdminAppointments() {
  const [rows, setRows] = useState<AdminAppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const offsetRef = useRef(0);
  const filterRef = useRef<Filter>("all");

  const statusArg = () => (filterRef.current === "all" ? null : filterRef.current);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminService.getAppointmentsAdmin({ status: statusArg(), limit: PAGE, offset: 0 });
      setRows(data);
      offsetRef.current = PAGE;
      setHasMore(data.length === PAGE);
    } catch {
      setRows([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await adminService.getAppointmentsAdmin({ status: statusArg(), limit: PAGE, offset: offsetRef.current });
      setRows((prev) => {
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
  }, [loadingMore, hasMore]);

  // Recharge page 0 au changement de filtre.
  useEffect(() => {
    filterRef.current = filter;
    load();
  }, [filter, load]);

  return (
    <Screen>
      <AdminHeader title="Rendez-vous" />
      <View style={styles.filters}>
        <SegmentedControl items={FILTERS} value={filter} onChange={(k) => setFilter(k as Filter)} />
      </View>

      {loading && rows.length === 0 ? (
        <Loading />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => { if (isNearBottom(e)) loadMore(); }}
          scrollEventThrottle={400}
        >
          {rows.length === 0 ? (
            <EmptyState icon="calendar-outline" title="Aucun rendez-vous" message="Aucun rendez-vous ne correspond à ce filtre." />
          ) : (
            <>
              {rows.map((a) => <AdminAppointmentCard key={a.id} a={a} />)}
              <LoadMoreFooter hasMore={hasMore} loadingMore={loadingMore} onLoadMore={loadMore} />
            </>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { paddingTop: spacing.sm },
  content: { paddingTop: spacing.sm, paddingBottom: spacing.xxl, gap: spacing.sm },
});
