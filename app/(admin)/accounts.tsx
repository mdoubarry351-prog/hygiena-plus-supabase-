import { useEffect, useRef, useState, useCallback } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { Input } from "@/components/Input";
import { Loading } from "@/components/Loading";
import { AdminHeader } from "@/components/AdminHeader";
import { EmptyState } from "@/components/EmptyState";
import { LoadMoreFooter, isNearBottom } from "@/components/LoadMoreFooter";
import { useAuth } from "@/providers/AuthProvider";
import { adminService, type DoctorRow } from "@/lib/admin-service";
import type { Profile, UserRole } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

const ROLE_LABELS: Record<UserRole, string> = { user: "Utilisateur", doctor: "Médecin", admin: "Admin" };
const ROLE_COLORS: Record<UserRole, string> = { user: colors.secondary, doctor: colors.primary, admin: colors.danger };
const ROLES: UserRole[] = ["user", "doctor", "admin"];

// Onglets = filtre par rôle.
const TABS: { key: UserRole; label: string }[] = [
  { key: "user", label: "Utilisateurs" },
  { key: "doctor", label: "Médecins" },
  { key: "admin", label: "Administrateurs" },
];

export default function AdminAccounts() {
  const { session } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [doctorByUser, setDoctorByUser] = useState<Record<string, DoctorRow>>({});
  const [suspendedByUser, setSuspendedByUser] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);
  const PAGE = 20;

  const [tab, setTab] = useState<UserRole>("user");
  const [search, setSearch] = useState("");
  const [suspendedOnly, setSuspendedOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Profils paginés ; les fiches médecins et suspensions (peu nombreuses) sont chargées en entier pour les maps.
      const [us, docs, sus] = await Promise.all([
        adminService.getUsersPage(PAGE, 0),
        adminService.getDoctors(),
        adminService.getSuspensions(),
      ]);
      setProfiles(us);
      offsetRef.current = PAGE;
      setHasMore(us.length === PAGE);
      const dmap: Record<string, DoctorRow> = {};
      for (const d of docs) dmap[d.user_id] = d;
      setDoctorByUser(dmap);
      const smap: Record<string, string> = {};
      for (const s of sus) if (s.is_active) smap[s.user_id] = s.id;
      setSuspendedByUser(smap);
    } catch {
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await adminService.getUsersPage(PAGE, offsetRef.current);
      setProfiles((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...data.filter((p) => !seen.has(p.id))];
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

  const label = (p: Profile) => p.full_name ?? p.email ?? "ce compte";

  // ---------- Actions (réutilisent adminService) ----------
  function changeRole(p: Profile, role: UserRole) {
    if (!session?.user || role === p.role) return;
    Alert.alert("Changer le rôle", `Définir ${label(p)} comme « ${ROLE_LABELS[role]} » ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Confirmer",
        onPress: async () => {
          try {
            await adminService.updateUserRole(session.user.id, p.id, role);
            await load();
          } catch (e) {
            Alert.alert("Erreur", e instanceof Error ? e.message : "Mise à jour échouée");
          }
        },
      },
    ]);
  }

  function suspend(p: Profile) {
    if (!session?.user) return;
    Alert.alert("Suspendre le compte ?", `${label(p)} ne pourra plus se connecter.`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Suspendre",
        style: "destructive",
        onPress: async () => {
          try {
            await adminService.suspendUser(session.user.id, p.id, null, null);
            await load();
          } catch (e) {
            Alert.alert("Erreur", e instanceof Error ? e.message : "Action échouée");
          }
        },
      },
    ]);
  }

  function reactivate(p: Profile) {
    const sid = suspendedByUser[p.id];
    if (!session?.user || !sid) return;
    Alert.alert("Réactiver le compte ?", "La suspension sera levée.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Réactiver",
        onPress: async () => {
          try {
            await adminService.liftSuspension(session.user.id, sid, p.id);
            await load();
          } catch (e) {
            Alert.alert("Erreur", e instanceof Error ? e.message : "Action échouée");
          }
        },
      },
    ]);
  }

  function deleteAccount(p: Profile, isDoctor: boolean) {
    if (!session?.user) return;
    Alert.alert(
      "Supprimer définitivement ?",
      `Le compte de ${label(p)} et toutes ses données seront supprimés. Action IRRÉVERSIBLE.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              if (isDoctor) await adminService.deleteDoctorAccount(session.user.id, p.id);
              else await adminService.deleteUserAccount(session.user.id, p.id);
              setExpandedId(null);
              await load();
            } catch (e) {
              Alert.alert("Erreur", e instanceof Error ? e.message : "Suppression échouée");
            }
          },
        },
      ]
    );
  }

  function validateDoctor(d: DoctorRow, validate: boolean) {
    if (!session?.user) return;
    Alert.alert(
      validate ? "Valider ce médecin ?" : "Révoquer ce médecin ?",
      validate ? "Sa fiche deviendra visible." : "Sa fiche ne sera plus visible.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: validate ? "Valider" : "Révoquer",
          style: validate ? "default" : "destructive",
          onPress: async () => {
            try {
              await adminService.setDoctorValidation(session.user.id, d.id, validate);
              await load();
            } catch (e) {
              Alert.alert("Erreur", e instanceof Error ? e.message : "Action échouée");
            }
          },
        },
      ]
    );
  }

  function demote(d: DoctorRow) {
    if (!session?.user) return;
    Alert.alert("Retirer le statut médecin ?", "Le compte redeviendra un utilisateur simple (fiche supprimée).", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Retirer",
        style: "destructive",
        onPress: async () => {
          try {
            await adminService.demoteDoctor(session.user.id, { id: d.id, user_id: d.user_id });
            await load();
          } catch (e) {
            Alert.alert("Erreur", e instanceof Error ? e.message : "Action échouée");
          }
        },
      },
    ]);
  }

  if (loading && profiles.length === 0) return <Loading />;

  const q = search.trim().toLowerCase();
  const list = profiles
    .filter((p) => p.role === tab)
    .filter((p) => !suspendedOnly || !!suspendedByUser[p.id])
    .filter(
      (p) =>
        !q ||
        (p.full_name ?? "").toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q) ||
        (p.phone ?? "").toLowerCase().includes(q)
    );

  return (
    <Screen>
      <AdminHeader title="Gestion des comptes" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => { if (isNearBottom(e)) loadMore(); }}
        scrollEventThrottle={400}
      >
        <Text style={styles.subtitle}>Recherchez, filtrez et gérez tous les comptes.</Text>

        {/* Onglets par rôle */}
        <View style={styles.tabs}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => { setTab(t.key); setExpandedId(null); }}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Recherche + Filtres */}
        <View style={styles.searchRow}>
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Nom, téléphone ou email…"
            autoCapitalize="none"
            style={styles.searchInput}
          />
          <Pressable
            onPress={() => setSuspendedOnly((v) => !v)}
            style={[styles.filterBtn, suspendedOnly && styles.filterBtnActive]}
          >
            <Ionicons name="filter" size={18} color={suspendedOnly ? colors.white : colors.text} />
            <Text style={[styles.filterText, suspendedOnly && styles.filterTextActive]}>Filtres</Text>
          </Pressable>
        </View>

        <Text style={styles.count}>
          {list.length} résultat{list.length > 1 ? "s" : ""}{suspendedOnly ? " · suspendus" : ""}
        </Text>

        {list.length === 0 ? (
          <EmptyState icon="people-outline" title="Aucun compte" message="Aucun compte ne correspond à ces critères." />
        ) : (
          <>
          {list.map((p) => {
            const open = expandedId === p.id;
            const isSuspended = !!suspendedByUser[p.id];
            const isSelf = session?.user?.id === p.id;
            const doctor = doctorByUser[p.id];
            return (
              <Pressable key={p.id} onPress={() => setExpandedId(open ? null : p.id)}>
                <Card style={styles.row}>
                  <Avatar name={label(p)} size={40} />
                  <View style={styles.rowInfo}>
                    <Text style={styles.name} numberOfLines={1}>{p.full_name ?? "Sans nom"}</Text>
                    <Text style={styles.contact} numberOfLines={1}>{p.phone ?? p.email ?? "—"}</Text>
                    {isSuspended ? <Text style={styles.suspendedTag}>● Suspendu</Text> : null}
                  </View>
                  <Text style={[styles.badge, { backgroundColor: ROLE_COLORS[p.role] }]}>{ROLE_LABELS[p.role]}</Text>
                </Card>

                {open && (
                  <Card style={styles.detail}>
                    <Text style={styles.detailLine}>Email : {p.email ?? "—"}</Text>
                    <Text style={styles.detailLine}>Téléphone : {p.phone ?? "—"}</Text>
                    <Text style={styles.detailLine}>Inscrit le {new Date(p.created_at).toLocaleDateString("fr-FR")}</Text>

                    {isSelf ? (
                      <Text style={styles.selfNote}>C'est votre compte : actions indisponibles.</Text>
                    ) : (
                      <>
                        {/* Rôle */}
                        <Text style={styles.detailLabel}>Rôle</Text>
                        <View style={styles.roleRow}>
                          {ROLES.map((r) => (
                            <Pressable
                              key={r}
                              onPress={() => changeRole(p, r)}
                              style={[styles.roleBtn, p.role === r && { backgroundColor: ROLE_COLORS[r], borderColor: ROLE_COLORS[r] }]}
                            >
                              <Text style={[styles.roleBtnText, p.role === r && styles.roleBtnTextActive]}>{ROLE_LABELS[r]}</Text>
                            </Pressable>
                          ))}
                        </View>

                        {/* Actions médecin (si fiche doctors) */}
                        {doctor ? (
                          <View style={styles.actions}>
                            {doctor.is_validated ? (
                              <Pressable style={[styles.actionBtn, styles.actionOutline]} onPress={() => validateDoctor(doctor, false)}>
                                <Ionicons name="close" size={16} color={colors.danger} />
                                <Text style={[styles.actionText, { color: colors.danger }]}>Révoquer</Text>
                              </Pressable>
                            ) : (
                              <Pressable style={[styles.actionBtn, styles.actionPrimary]} onPress={() => validateDoctor(doctor, true)}>
                                <Ionicons name="checkmark" size={16} color={colors.white} />
                                <Text style={[styles.actionText, { color: colors.white }]}>Valider</Text>
                              </Pressable>
                            )}
                            <Pressable style={[styles.actionBtn, styles.actionMuted]} onPress={() => demote(doctor)}>
                              <Ionicons name="person-remove-outline" size={16} color={colors.textMuted} />
                              <Text style={[styles.actionText, { color: colors.textMuted }]}>Retirer statut</Text>
                            </Pressable>
                          </View>
                        ) : null}

                        {/* Suspendre / réactiver + supprimer */}
                        <View style={styles.actions}>
                          {isSuspended ? (
                            <Pressable style={[styles.actionBtn, styles.actionReactivate]} onPress={() => reactivate(p)}>
                              <Ionicons name="refresh" size={16} color={colors.primary} />
                              <Text style={[styles.actionText, { color: colors.primary }]}>Réactiver</Text>
                            </Pressable>
                          ) : (
                            <Pressable style={[styles.actionBtn, styles.actionSuspend]} onPress={() => suspend(p)}>
                              <Ionicons name="hand-left-outline" size={16} color={colors.accent} />
                              <Text style={[styles.actionText, { color: colors.accent }]}>Suspendre</Text>
                            </Pressable>
                          )}
                          <Pressable style={[styles.actionBtn, styles.actionOutline]} onPress={() => deleteAccount(p, !!doctor)}>
                            <Ionicons name="trash-outline" size={16} color={colors.danger} />
                            <Text style={[styles.actionText, { color: colors.danger }]}>Supprimer</Text>
                          </Pressable>
                        </View>
                      </>
                    )}
                  </Card>
                )}
              </Pressable>
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
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  subtitle: { ...typography.caption, color: colors.textMuted },
  tabs: { flexDirection: "row", gap: spacing.xs, backgroundColor: colors.surface, borderRadius: radius.md, padding: 4 },
  tab: { flex: 1, alignItems: "center", paddingVertical: spacing.sm, borderRadius: radius.sm },
  tabActive: { backgroundColor: colors.primary },
  tabText: { ...typography.caption, fontWeight: "700", color: colors.textMuted },
  tabTextActive: { color: colors.white },
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  searchInput: { flex: 1, marginBottom: 0 },
  filterBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, height: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border },
  filterBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { ...typography.caption, fontWeight: "700", color: colors.text },
  filterTextActive: { color: colors.white },
  count: { ...typography.caption, color: colors.textMuted },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontWeight: "700", color: colors.primaryDark },
  rowInfo: { flex: 1, gap: 2 },
  name: { ...typography.name },
  contact: { ...typography.caption, color: colors.textMuted },
  suspendedTag: { ...typography.caption, color: colors.danger, fontWeight: "700" },
  badge: { ...typography.caption, color: colors.white, fontWeight: "700", paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, overflow: "hidden" },
  detail: { marginTop: spacing.xs, gap: spacing.xs, backgroundColor: colors.surface },
  detailLine: { ...typography.caption, color: colors.text },
  detailLabel: { ...typography.caption, fontWeight: "700", marginTop: spacing.xs },
  selfNote: { ...typography.caption, color: colors.textMuted, fontStyle: "italic", marginTop: spacing.xs },
  roleRow: { flexDirection: "row", gap: spacing.sm },
  roleBtn: { flex: 1, alignItems: "center", paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border },
  roleBtnText: { ...typography.caption, fontWeight: "600", color: colors.text },
  roleBtnTextActive: { color: colors.white },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1.5 },
  actionPrimary: { backgroundColor: colors.success, borderColor: colors.success },
  actionOutline: { borderColor: colors.danger },
  actionMuted: { borderColor: colors.border },
  actionSuspend: { borderColor: colors.accent },
  actionReactivate: { borderColor: colors.primary },
  actionText: { ...typography.caption, fontWeight: "700" },
});
