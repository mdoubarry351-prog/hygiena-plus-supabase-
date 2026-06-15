import { useEffect, useRef, useState, useCallback } from "react";
import { ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Loading } from "@/components/Loading";
import { EmptyState } from "@/components/EmptyState";
import { AdminHeader } from "@/components/AdminHeader";
import { SegmentedControl } from "@/components/SegmentedControl";
import { LoadMoreFooter, isNearBottom } from "@/components/LoadMoreFooter";
import { adminService, type AdminAppointmentRow } from "@/lib/admin-service";
import { formatAppointmentDate, formatAppointmentTime } from "@/lib/appointments-service";
import type { AppointmentStatus } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

const PAGE = 20;

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmé",
  cancelled: "Annulé",
  completed: "Terminé",
};
const STATUS_COLORS: Record<AppointmentStatus, string> = {
  pending: colors.accent,
  confirmed: colors.secondary,
  cancelled: colors.danger,
  completed: colors.success,
};

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
              {rows.map((a) => {
                const patient = a.patient_name?.trim() || "Patiente";
                const doctor = a.doctor_name?.trim() || "Médecin";
                return (
                  <Card key={a.id} style={styles.row}>
                    <View style={styles.head}>
                      <View style={styles.names}>
                        <Text style={styles.patient} numberOfLines={1}>{patient}</Text>
                        <View style={styles.metaLine}>
                          <Ionicons name="medkit-outline" size={13} color={colors.textMuted} />
                          <Text style={styles.doctor} numberOfLines={1}>{doctor}{a.specialty ? ` · ${a.specialty}` : ""}</Text>
                        </View>
                      </View>
                      <Badge label={STATUS_LABELS[a.status]} color={STATUS_COLORS[a.status]} />
                    </View>
                    <View style={styles.foot}>
                      <View style={styles.metaLine}>
                        <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                        <Text style={styles.meta}>{formatAppointmentDate(a.appointment_date)}</Text>
                      </View>
                      <View style={styles.metaLine}>
                        <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                        <Text style={styles.meta}>{formatAppointmentTime(a.appointment_time)}</Text>
                      </View>
                      {a.is_paid ? (
                        <View style={styles.metaLine}>
                          <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                          <Text style={styles.meta}>Payé</Text>
                        </View>
                      ) : null}
                    </View>
                  </Card>
                );
              })}
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
  row: { gap: spacing.sm },
  head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  names: { flex: 1, gap: 2 },
  patient: { ...typography.name },
  doctor: { ...typography.caption, color: colors.textMuted, flex: 1 },
  metaLine: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  foot: { flexDirection: "row", alignItems: "center", gap: spacing.lg, flexWrap: "wrap", borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  meta: { ...typography.caption, color: colors.textMuted, textTransform: "capitalize" },
});
