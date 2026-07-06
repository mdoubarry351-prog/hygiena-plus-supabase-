import { useEffect, useState, useCallback } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Badge, type BadgeTone } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Loading } from "@/components/Loading";
import { AdminHeader } from "@/components/AdminHeader";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/providers/AuthProvider";
import { adminService, REPORT_STATUSES, type ReportRow, type ReportStatus } from "@/lib/admin-service";
import { colors, radius, spacing, typography } from "@/theme";

const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: "En attente",
  resolved: "Résolu",
  dismissed: "Rejeté",
};
const STATUS_COLORS: Record<string, string> = {
  pending: colors.accent,
  resolved: colors.success,
  dismissed: colors.textMuted,
};
// Tons de badge par statut (le badge passe en tonal ; les couleurs ci-dessus
// restent utilisées par les boutons de changement de statut).
const STATUS_TONE: Record<ReportStatus, BadgeTone> = {
  pending: "warning",
  resolved: "success",
  dismissed: "neutral",
};

export default function AdminReports() {
  const { session } = useAuth();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReports(await adminService.getReports());
    } catch {
      setReports([]);
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

  function toggle(r: ReportRow) {
    if (openId === r.id) { setOpenId(null); return; }
    setOpenId(r.id);
    setNote(r.admin_note ?? "");
  }

  async function applyStatus(r: ReportRow, status: ReportStatus) {
    if (!session?.user) return;
    try {
      await adminService.updateReport(session.user.id, r.id, status, note.trim() || null);
      setReports((prev) => prev.map((x) => (x.id === r.id ? { ...x, status, admin_note: note.trim() || null } : x)));
      Alert.alert("Enregistré", "Le signalement a été mis à jour.");
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Action échouée");
    }
  }

  if (loading && reports.length === 0) return <Loading />;

  return (
    <Screen>
      <AdminHeader title="Signalements" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {reports.length === 0 ? (
          <EmptyState icon="flag-outline" title="Aucun signalement" message="Tout est calme côté communauté." />
        ) : (
          reports.map((r) => {
            const open = openId === r.id;
            return (
              <Card key={r.id} style={styles.card}>
                <Pressable onPress={() => toggle(r)}>
                  <View style={styles.head}>
                    <Text style={styles.reason} numberOfLines={open ? undefined : 2}>{r.reason}</Text>
                    <Badge label={STATUS_LABELS[r.status as ReportStatus] ?? r.status} tone={STATUS_TONE[r.status as ReportStatus] ?? "neutral"} soft />
                  </View>
                  <Text style={styles.meta}>
                    Par {r.reporter?.full_name ?? "—"}
                    {r.reported?.full_name ? ` · visé : ${r.reported.full_name}` : ""}
                    {" · "}{new Date(r.created_at).toLocaleDateString("fr-FR")}
                  </Text>
                </Pressable>

                {open && (
                  <View style={styles.detail}>
                    <Input
                      label="Note administrateur"
                      value={note}
                      onChangeText={setNote}
                      placeholder="Note interne (facultatif)"
                      multiline
                      numberOfLines={3}
                      style={styles.textArea}
                    />
                    <View style={styles.statusRow}>
                      {REPORT_STATUSES.map((s) => (
                        <Pressable
                          key={s}
                          onPress={() => applyStatus(r, s)}
                          style={[styles.statusBtn, r.status === s && { backgroundColor: STATUS_COLORS[s], borderColor: STATUS_COLORS[s] }]}
                        >
                          <Text style={[styles.statusBtnText, r.status === s && styles.statusBtnTextActive]}>{STATUS_LABELS[s]}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
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
  head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  reason: { ...typography.name, flex: 1 },
  badge: { ...typography.caption, color: colors.white, fontWeight: "700", paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, overflow: "hidden" },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  detail: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  textArea: { height: 80, textAlignVertical: "top", paddingTop: spacing.sm },
  statusRow: { flexDirection: "row", gap: spacing.sm },
  statusBtn: { flex: 1, alignItems: "center", paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border },
  statusBtnText: { ...typography.caption, fontWeight: "600", color: colors.text },
  statusBtnTextActive: { color: colors.white },
});
