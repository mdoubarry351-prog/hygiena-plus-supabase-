import { useEffect, useState, useCallback } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Loading } from "@/components/Loading";
import { AdminHeader } from "@/components/AdminHeader";
import { EmptyState } from "@/components/EmptyState";
import { ExportButton } from "@/components/ExportButton";
import { useAuth } from "@/providers/AuthProvider";
import { adminService } from "@/lib/admin-service";
import { exportCsv } from "@/lib/csv-export";
import type { Profile, UserRole } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

const ROLE_LABELS: Record<UserRole, string> = { user: "Utilisateur", doctor: "Médecin", admin: "Admin" };
const ROLE_COLORS: Record<UserRole, string> = { user: colors.secondary, doctor: colors.primary, admin: colors.danger };
const ROLES: UserRole[] = ["user", "doctor", "admin"];

export default function AdminUsers() {
  const { session } = useAuth();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Profile | null>(null);
  // userId -> id de la ligne user_suspensions active (pour la réactivation)
  const [suspendedMap, setSuspendedMap] = useState<Record<string, string>>({});

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const [us, sus] = await Promise.all([
        adminService.getUsers(q),
        adminService.getSuspensions(),
      ]);
      setUsers(us);
      const map: Record<string, string> = {};
      for (const s of sus) if (s.is_active) map[s.user_id] = s.id;
      setSuspendedMap(map);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleExport() {
    try {
      const rows = users.map((u) => ({
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
      Alert.alert("Export impossible", e instanceof Error ? e.message : "Réessayez.");
    }
  }

  const targetLabel = (u: Profile) => u.full_name ?? u.email ?? "cet utilisateur";

  function suspend(u: Profile) {
    if (!session?.user) return;
    Alert.alert(
      "Suspendre le compte ?",
      `${targetLabel(u)} ne pourra plus se connecter tant que la suspension est active.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Suspendre",
          style: "destructive",
          onPress: async () => {
            try {
              await adminService.suspendUser(session.user.id, u.id, null, null);
              await load(search.trim() || undefined);
              Alert.alert("Suspendu", "Le compte a été suspendu.");
            } catch (e) {
              Alert.alert("Erreur", e instanceof Error ? e.message : "Action échouée");
            }
          },
        },
      ]
    );
  }

  function reactivate(u: Profile) {
    const sid = suspendedMap[u.id];
    if (!session?.user || !sid) return;
    Alert.alert("Réactiver le compte ?", "La suspension sera levée et l'utilisateur pourra à nouveau se connecter.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Réactiver",
        onPress: async () => {
          try {
            await adminService.liftSuspension(session.user.id, sid, u.id);
            await load(search.trim() || undefined);
          } catch (e) {
            Alert.alert("Erreur", e instanceof Error ? e.message : "Action échouée");
          }
        },
      },
    ]);
  }

  function deleteAccount(u: Profile) {
    if (!session?.user) return;
    Alert.alert(
      "Supprimer définitivement ?",
      `Le compte de ${targetLabel(u)} et toutes ses données seront supprimés. Cette action est IRRÉVERSIBLE.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await adminService.deleteUserAccount(session.user.id, u.id);
              setSelected(null);
              setUsers((prev) => prev.filter((x) => x.id !== u.id));
              Alert.alert("Supprimé", "Le compte a été supprimé définitivement.");
            } catch (e) {
              Alert.alert("Erreur", e instanceof Error ? e.message : "Suppression échouée");
            }
          },
        },
      ]
    );
  }

  function changeRole(user: Profile, role: UserRole) {
    if (!session?.user || role === user.role) return;
    Alert.alert("Changer le rôle", `Définir ${user.full_name ?? user.email ?? "cet utilisateur"} comme « ${ROLE_LABELS[role]} » ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Confirmer",
        onPress: async () => {
          try {
            await adminService.updateUserRole(session.user.id, user.id, role);
            setSelected((s) => (s ? { ...s, role } : s));
            setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role } : u)));
          } catch (e) {
            Alert.alert("Erreur", e instanceof Error ? e.message : "Mise à jour échouée");
          }
        },
      },
    ]);
  }

  return (
    <Screen>
      <AdminHeader title="Utilisateurs" right={<ExportButton onPress={handleExport} />} />
      <View style={styles.searchRow}>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher (nom ou email)…"
          autoCapitalize="none"
          style={styles.searchInput}
          returnKeyType="search"
          onSubmitEditing={() => load(search)}
        />
      </View>

      {loading && users.length === 0 ? (
        <Loading />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {users.length === 0 ? (
            <EmptyState icon="people-outline" title="Aucun utilisateur" />
          ) : (
            users.map((u) => {
              const open = selected?.id === u.id;
              const isSuspended = !!suspendedMap[u.id];
              const isSelf = session?.user?.id === u.id;
              return (
                <Pressable key={u.id} onPress={() => setSelected(open ? null : u)}>
                  <Card style={styles.row}>
                    <View style={styles.avatar}><Text style={styles.avatarText}>{(u.full_name ?? u.email ?? "?").charAt(0).toUpperCase()}</Text></View>
                    <View style={styles.rowInfo}>
                      <Text style={styles.name} numberOfLines={1}>{u.full_name ?? "Sans nom"}</Text>
                      <Text style={styles.email} numberOfLines={1}>{u.email ?? "—"}</Text>
                      {isSuspended ? <Text style={styles.suspendedTag}>● Suspendu</Text> : null}
                    </View>
                    <Text style={[styles.badge, { backgroundColor: ROLE_COLORS[u.role] }]}>{ROLE_LABELS[u.role]}</Text>
                  </Card>
                  {open && (
                    <Card style={styles.detail}>
                      <Text style={styles.detailLine}>Téléphone : {u.phone ?? "—"}</Text>
                      <Text style={styles.detailLine}>Premium : {u.is_premium ? "Oui" : "Non"}</Text>
                      <Text style={styles.detailLine}>Inscrit le {new Date(u.created_at).toLocaleDateString("fr-FR")}</Text>
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
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchRow: { paddingTop: spacing.sm },
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
