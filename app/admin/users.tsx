import { useEffect, useRef, useState, useCallback } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { Badge, type BadgeTone } from "@/components/Badge";
import { Input } from "@/components/Input";
import { Loading } from "@/components/Loading";
import { AdminHeader } from "@/components/AdminHeader";
import { SegmentedControl } from "@/components/SegmentedControl";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/providers/ToastProvider";
import { EmptyState } from "@/components/EmptyState";
import { ExportButton } from "@/components/ExportButton";
import { LoadMoreFooter, isNearBottom } from "@/components/LoadMoreFooter";
import { useAuth } from "@/providers/AuthProvider";
import { adminService, type UserActivity } from "@/lib/admin-service";
import { PREMIUM_ENABLED } from "@/lib/app-config";
import { exportCsv } from "@/lib/csv-export";
import type { Profile, UserRole } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

const ROLE_LABELS: Record<UserRole, string> = { user: "Utilisateur", doctor: "Médecin", admin: "Admin" };
const ROLE_COLORS: Record<UserRole, string> = { user: colors.secondary, doctor: colors.primary, admin: colors.danger };
// Tons de badge par rôle (badge tonal ; ROLE_COLORS reste utilisé par les boutons).
const ROLE_TONE: Record<UserRole, BadgeTone> = { user: "info", doctor: "primary", admin: "danger" };
const ROLES: UserRole[] = ["user", "doctor", "admin"];

export default function AdminUsers() {
  const { session } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "suspended">("all");
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [activity, setActivity] = useState<UserActivity | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  // userId -> id de la ligne user_suspensions active (pour la réactivation)
  const [suspendedMap, setSuspendedMap] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);
  const offsetRef = useRef(0);
  const searchRef = useRef("");
  const PAGE = 20;

  // Recherche appliquée CÔTÉ SERVEUR (nom/email/téléphone). On lit searchRef pour
  // que load/loadMore restent stables sans dépendre de `search`.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [us, sus] = await Promise.all([
        adminService.getUsersPage(PAGE, 0, { search: searchRef.current || null }),
        adminService.getSuspensions(),
      ]);
      setUsers(us);
      offsetRef.current = PAGE;
      setHasMore(us.length === PAGE);
      const map: Record<string, string> = {};
      for (const s of sus) if (s.is_active) map[s.user_id] = s.id;
      setSuspendedMap(map);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await adminService.getUsersPage(PAGE, offsetRef.current, { search: searchRef.current || null });
      setUsers((prev) => {
        const seen = new Set(prev.map((u) => u.id));
        return [...prev, ...data.filter((u) => !seen.has(u.id))];
      });
      offsetRef.current += PAGE;
      setHasMore(data.length === PAGE);
    } catch {
      // garde l'état
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore]);

  // Recharge depuis le serveur (page 0) à chaque changement de recherche, avec debounce.
  useEffect(() => {
    searchRef.current = search;
    const t = setTimeout(() => { load(); }, 350);
    return () => clearTimeout(t);
  }, [search, load]);

  // Charge le récap d'activité à l'ouverture d'une fiche détail.
  useEffect(() => {
    const id = selected?.id;
    if (!id) { setActivity(null); return; }
    let cancelled = false;
    setActivity(null);
    setActivityLoading(true);
    adminService
      .getUserActivity(id)
      .then((a) => { if (!cancelled) setActivity(a); })
      .catch(() => { if (!cancelled) setActivity(null); })
      .finally(() => { if (!cancelled) setActivityLoading(false); });
    return () => { cancelled = true; };
  }, [selected?.id]);

  // La recherche est filtrée côté serveur ; le statut est filtré sur la page chargée.
  const filtered = users.filter((u) => {
    if (status === "active") return !suspendedMap[u.id];
    if (status === "suspended") return !!suspendedMap[u.id];
    return true;
  });

  async function handleExport() {
    setExporting(true);
    try {
      // Export COMPLET : toutes les lignes correspondant à la recherche serveur.
      const all = await adminService.getAllUsersFiltered({ search: search.trim() || null });
      const rows = all.map((u) => ({
        nom: u.full_name ?? "",
        email: u.email ?? "",
        telephone: u.phone ?? "",
        role: ROLE_LABELS[u.role],
        statut: suspendedMap[u.id] ? "Suspendu" : "Actif",
        inscription: new Date(u.created_at).toLocaleDateString("fr-FR"),
      }));
      await exportCsv("utilisateurs", rows, [
        { key: "nom", label: "Nom" },
        { key: "email", label: "Email" },
        { key: "telephone", label: "Téléphone" },
        { key: "role", label: "Rôle" },
        { key: "statut", label: "Statut" },
        { key: "inscription", label: "Inscription" },
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export impossible, réessayez.");
    } finally {
      setExporting(false);
    }
  }

  const targetLabel = (u: Profile) => u.full_name ?? u.email ?? "cet utilisateur";

  async function suspend(u: Profile) {
    if (!session?.user) return;
    const ok = await confirm({
      title: "Suspendre le compte ?",
      message: `${targetLabel(u)} ne pourra plus se connecter tant que la suspension est active.`,
      confirmLabel: "Suspendre",
      danger: true,
    });
    if (!ok) return;
    try {
      await adminService.suspendUser(session.user.id, u.id, null, null);
      await load();
      toast.success("Compte suspendu.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action échouée");
    }
  }

  async function reactivate(u: Profile) {
    const sid = suspendedMap[u.id];
    if (!session?.user || !sid) return;
    const ok = await confirm({
      title: "Réactiver le compte ?",
      message: "La suspension sera levée et l'utilisateur pourra à nouveau se connecter.",
      confirmLabel: "Réactiver",
    });
    if (!ok) return;
    try {
      await adminService.liftSuspension(session.user.id, sid, u.id);
      await load();
      toast.success("Compte réactivé.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action échouée");
    }
  }

  async function deleteAccount(u: Profile) {
    if (!session?.user) return;
    const ok = await confirm({
      title: "Supprimer définitivement ?",
      message: `Le compte de ${targetLabel(u)} et toutes ses données seront supprimés. Cette action est IRRÉVERSIBLE.`,
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    try {
      await adminService.deleteUserAccount(session.user.id, u.id);
      setSelected(null);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      toast.success("Compte supprimé définitivement.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suppression échouée");
    }
  }

  async function changeRole(user: Profile, role: UserRole) {
    if (!session?.user || role === user.role) return;
    const ok = await confirm({ title: "Changer le rôle", message: `Définir ${user.full_name ?? user.email ?? "cet utilisateur"} comme « ${ROLE_LABELS[role]} » ?`, confirmLabel: "Confirmer" });
    if (!ok) return;
    try {
      await adminService.updateUserRole(session.user.id, user.id, role);
      setSelected((s) => (s ? { ...s, role } : s));
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role } : u)));
      toast.success(`Rôle mis à jour : ${ROLE_LABELS[role]}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Mise à jour échouée");
    }
  }

  return (
    <Screen>
      <AdminHeader title="Utilisateurs" right={<ExportButton onPress={handleExport} loading={exporting} />} />
      <View style={styles.searchRow}>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher (nom ou email)…"
          autoCapitalize="none"
          style={styles.searchInput}
          returnKeyType="search"
        />
        <SegmentedControl
          items={[{ key: "all", label: "Tous" }, { key: "active", label: "Actifs" }, { key: "suspended", label: "Suspendus" }]}
          value={status}
          onChange={(k) => setStatus(k as "all" | "active" | "suspended")}
        />
      </View>

      {loading && users.length === 0 ? (
        <Loading />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => { if (isNearBottom(e)) loadMore(); }}
          scrollEventThrottle={400}
        >
          {filtered.length === 0 ? (
            <EmptyState icon="people-outline" title={search.trim() ? "Aucun résultat" : "Aucun utilisateur"} />
          ) : (
            filtered.map((u) => {
              const open = selected?.id === u.id;
              const isSuspended = !!suspendedMap[u.id];
              const isSelf = session?.user?.id === u.id;
              return (
                <Pressable key={u.id} onPress={() => setSelected(open ? null : u)}>
                  <Card style={styles.row}>
                    <Avatar name={u.full_name ?? u.email ?? "?"} size={40} />
                    <View style={styles.rowInfo}>
                      <Text style={styles.name} numberOfLines={1}>{u.full_name ?? "Sans nom"}</Text>
                      <Text style={styles.email} numberOfLines={1}>{u.email ?? "—"}</Text>
                      {isSuspended ? <Text style={styles.suspendedTag}>● Suspendu</Text> : null}
                    </View>
                    <Badge label={ROLE_LABELS[u.role]} tone={ROLE_TONE[u.role]} soft />
                  </Card>
                  {open && (
                    <Card style={styles.detail}>
                      <Text style={styles.detailLine}>Téléphone : {u.phone ?? "—"}</Text>
                      {PREMIUM_ENABLED ? <Text style={styles.detailLine}>Premium : {u.is_premium ? "Oui" : "Non"}</Text> : null}
                      <Text style={styles.detailLine}>Inscrit le {new Date(u.created_at).toLocaleDateString("fr-FR")}</Text>

                      {/* Activité */}
                      <Text style={[styles.detailLine, styles.detailLabel]}>Activité :</Text>
                      {activityLoading ? (
                        <ActivityIndicator color={colors.primary} style={styles.activitySpinner} />
                      ) : activity ? (
                        <View style={styles.activityRow}>
                          <ActivityStat icon="bag-handle-outline" value={activity.orders} label="Commandes" />
                          <ActivityStat icon="chatbubbles-outline" value={activity.posts} label="Publications" />
                          <ActivityStat icon="calendar-outline" value={activity.appointments} label="Rendez-vous" />
                        </View>
                      ) : (
                        <Text style={styles.detailLine}>—</Text>
                      )}

                      <Text style={[styles.detailLine, styles.detailLabel]}>Rôle :</Text>
                      <View style={styles.roleRow}>
                        {ROLES.map((r) => (
                          <Pressable
                            key={r}
                            onPress={() => changeRole(u, r)}
                            style={[styles.roleBtn, u.role === r && { backgroundColor: ROLE_COLORS[r], borderColor: ROLE_COLORS[r] }]}
                          >
                            <Text style={[styles.roleBtnText, u.role === r && styles.roleBtnTextActive]}>{ROLE_LABELS[r]}</Text>
                          </Pressable>
                        ))}
                      </View>

                      {isSelf ? (
                        <Text style={styles.selfNote}>C'est votre compte : actions de suspension/suppression indisponibles.</Text>
                      ) : (
                        <View style={styles.actions}>
                          {isSuspended ? (
                            <Pressable style={[styles.actionBtn, styles.actionReactivate]} onPress={() => reactivate(u)}>
                              <Ionicons name="refresh" size={16} color={colors.primary} />
                              <Text style={styles.actionReactivateText}>Réactiver</Text>
                            </Pressable>
                          ) : (
                            <Pressable style={[styles.actionBtn, styles.actionSuspend]} onPress={() => suspend(u)}>
                              <Ionicons name="hand-left-outline" size={16} color={colors.accent} />
                              <Text style={styles.actionSuspendText}>Suspendre</Text>
                            </Pressable>
                          )}
                          <Pressable style={[styles.actionBtn, styles.actionDelete]} onPress={() => deleteAccount(u)}>
                            <Ionicons name="trash-outline" size={16} color={colors.danger} />
                            <Text style={styles.actionDeleteText}>Supprimer</Text>
                          </Pressable>
                        </View>
                      )}
                    </Card>
                  )}
                </Pressable>
              );
            })
          )}
          <LoadMoreFooter hasMore={hasMore} loadingMore={loadingMore} onLoadMore={loadMore} />
        </ScrollView>
      )}
    </Screen>
  );
}

// Petit compteur d'activité (icône + valeur + libellé) pour la fiche détail.
function ActivityStat({ icon, value, label }: { icon: keyof typeof Ionicons.glyphMap; value: number; label: string }) {
  return (
    <View style={styles.activityStat}>
      <Ionicons name={icon} size={18} color={colors.primaryDark} />
      <Text style={styles.activityValue}>{value}</Text>
      <Text style={styles.activityLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: { paddingTop: spacing.sm },
  activitySpinner: { alignSelf: "flex-start", marginVertical: spacing.xs },
  activityRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  activityStat: { flex: 1, alignItems: "center", gap: 2, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  activityValue: { ...typography.name, color: colors.primaryDark },
  activityLabel: { ...typography.caption, color: colors.textMuted },
  searchInput: { marginBottom: 0 },
  content: { paddingTop: spacing.sm, paddingBottom: spacing.xxl, gap: spacing.sm },
  empty: { alignItems: "center" },
  muted: { color: colors.textMuted },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontWeight: "700", color: colors.primaryDark },
  rowInfo: { flex: 1, gap: 2 },
  name: { ...typography.name },
  email: { ...typography.caption, color: colors.textMuted },
  badge: { ...typography.caption, color: colors.white, fontWeight: "700", paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, overflow: "hidden" },
  detail: { marginTop: spacing.xs, gap: spacing.xs, backgroundColor: colors.surface },
  detailLine: { ...typography.caption, color: colors.text },
  detailLabel: { fontWeight: "700", marginTop: spacing.xs },
  roleRow: { flexDirection: "row", gap: spacing.sm },
  roleBtn: { flex: 1, alignItems: "center", paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border },
  roleBtnText: { ...typography.caption, fontWeight: "600", color: colors.text },
  roleBtnTextActive: { color: colors.white },
  suspendedTag: { ...typography.caption, color: colors.danger, fontWeight: "700" },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1.5 },
  actionSuspend: { borderColor: colors.accent },
  actionSuspendText: { ...typography.caption, color: colors.accent, fontWeight: "700" },
  actionReactivate: { borderColor: colors.primary },
  actionReactivateText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
  actionDelete: { borderColor: colors.danger },
  actionDeleteText: { ...typography.caption, color: colors.danger, fontWeight: "700" },
  selfNote: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm, fontStyle: "italic" },
});
