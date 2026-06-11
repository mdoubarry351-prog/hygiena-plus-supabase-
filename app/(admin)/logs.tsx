import { useEffect, useState, useCallback } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Loading } from "@/components/Loading";
import { AdminHeader } from "@/components/AdminHeader";
import { EmptyState } from "@/components/EmptyState";
import { adminService, type AuditLogRow } from "@/lib/admin-service";
import { colors, radius, spacing, typography } from "@/theme";

// Catégorie (couleur) déduite de l'action.
type Category = "delete" | "suspend" | "validate" | "update";

function categoryOf(action: string): Category {
  if (action.includes("delete")) return "delete";
  if (action.includes("suspend") || action.includes("ban") || action.includes("demote") || action.includes("reject")) return "suspend";
  if (action.includes("validate") || action.includes("add") || action.includes("create") || action.includes("lift")) return "validate";
  return "update";
}

const CATEGORY_COLOR: Record<Category, string> = {
  delete: colors.danger,
  suspend: colors.accent,
  validate: colors.primary,
  update: colors.secondary,
};

// Libellés lisibles des actions connues (repli = action brute).
const ACTION_LABELS: Record<string, string> = {
  update_user_role: "Changement de rôle",
  suspend_user: "Suspension de compte",
  lift_suspension: "Réactivation de compte",
  delete_user: "Suppression de compte",
  delete_doctor_account: "Suppression compte médecin",
  add_doctor: "Ajout d'un médecin",
  demote_doctor: "Retrait du statut médecin",
  validate_doctor: "Validation médecin",
  reject_doctor: "Révocation médecin",
  create_product: "Création produit",
  update_product: "Modification produit",
  update_order_status: "Statut commande mis à jour",
  delete_post: "Suppression publication",
  update_report: "Traitement signalement",
  update_settings: "Modification des réglages",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

// Filtres (chips) par catégorie.
const FILTERS: { key: "all" | Category; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "delete", label: "Suppressions" },
  { key: "suspend", label: "Suspensions" },
  { key: "validate", label: "Validations" },
  { key: "update", label: "Modifications" },
];

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const PAGE = 100;

export default function AdminLogs() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [filter, setFilter] = useState<"all" | Category>("all");

  const load = useCallback(async (lim: number) => {
    try {
      setLogs(await adminService.getAuditLogs(lim));
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(limit); }, [load, limit]);

  async function onRefresh() {
    setRefreshing(true);
    await load(limit);
    setRefreshing(false);
  }

  if (loading && logs.length === 0) return <Loading />;

  const filtered = filter === "all" ? logs : logs.filter((l) => categoryOf(l.action) === filter);
  const canLoadMore = logs.length >= limit;

  return (
    <Screen>
      <AdminHeader title="Journal d'audit" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Text style={styles.subtitle}>Historique des actions sensibles, de la plus récente à la plus ancienne.</Text>

        {/* Filtres par type */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {filtered.length === 0 ? (
          <EmptyState icon="document-text-outline" title="Aucune action enregistrée" message="Les actions admin apparaîtront ici." />
        ) : (
          <>
            {filtered.map((l) => {
              const color = CATEGORY_COLOR[categoryOf(l.action)];
              const target = l.target_table
                ? `${l.target_table}${l.target_id ? ` · ${l.target_id.slice(0, 8)}` : ""}`
                : "—";
              return (
                <Card key={l.id} style={styles.row}>
                  <View style={[styles.dot, { backgroundColor: color }]} />
                  <View style={styles.rowInfo}>
                    <Text style={[styles.action, { color }]} numberOfLines={1}>{actionLabel(l.action)}</Text>
                    <Text style={styles.meta} numberOfLines={1}>Cible : {target}</Text>
                    <Text style={styles.meta} numberOfLines={1}>Par {l.adminName || "Admin"}</Text>
                  </View>
                  <Text style={styles.date}>{formatDateTime(l.created_at)}</Text>
                </Card>
              );
            })}

            {canLoadMore && filter === "all" ? (
              <Pressable onPress={() => setLimit((n) => n + PAGE)} style={styles.loadMore}>
                <Text style={styles.loadMoreText}>Charger plus</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  subtitle: { ...typography.caption, color: colors.textMuted },
  chips: { gap: spacing.xs, paddingVertical: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, fontWeight: "700", color: colors.text },
  chipTextActive: { color: colors.white },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  rowInfo: { flex: 1, gap: 2 },
  action: { ...typography.name },
  meta: { ...typography.caption, color: colors.textMuted },
  date: { ...typography.caption, color: colors.textMuted },
  loadMore: { alignItems: "center", paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary },
  loadMoreText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
});
